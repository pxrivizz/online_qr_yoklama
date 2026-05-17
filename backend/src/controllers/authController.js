const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { pool } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email ve şifre zorunludur!' });
    }

    // Query user by email
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Geçersiz email veya şifre' });
    }

    const user = result.rows[0];

    // Compare password directly
    const isPasswordValid = password === user.password;

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Geçersiz email veya şifre' });
    }

    // Sign JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error details:', error.message, error.stack);
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'Google credential token gereklidir.' });
    }

    // 1. Verify the Google token using the official library
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch (verifyError) {
      console.error('Google token verification failed:', verifyError.message);
      return res.status(401).json({ error: 'Geçersiz Google token.' });
    }

    const payload = ticket.getPayload();
    const { email, given_name, family_name, picture, sub: googleId } = payload;

    if (!email) {
      return res.status(400).json({ error: 'Google hesabında email bulunamadı.' });
    }

    // 2. Check if user already exists in the database
    let result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length > 0) {
      // User exists — log them in normally
      const user = result.rows[0];

      // Update avatar if it changed
      if (picture && user.avatar_url !== picture) {
        await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [picture, user.id]);
        user.avatar_url = picture;
      }

      // Generate internal JWT for the application
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, name: user.name },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      return res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar_url: user.avatar_url,
          auth_provider: user.auth_provider || 'google',
        },
      });
    }

    // 3. User does NOT exist — do NOT save yet, ask frontend for student number
    const name = [given_name, family_name].filter(Boolean).join(' ') || email.split('@')[0];
    return res.json({
      requireStudentId: true,
      googleUser: {
        email,
        name,
        picture: picture || null,
      },
    });
  } catch (error) {
    console.error('Google login error:', error.message, error.stack);
    return res.status(500).json({ error: 'Google ile giriş sırasında bir hata oluştu.' });
  }
};

const registerStudent = async (req, res) => {
  const client = await pool.connect();
  try {
    const { credential, studentNumber } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'Google credential token gereklidir.' });
    }

    if (!studentNumber || !studentNumber.trim()) {
      return res.status(400).json({ error: 'Öğrenci numarası zorunludur.' });
    }

    const trimmedStudentNumber = studentNumber.trim();

    // 1. Verify Google token again for security
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch (verifyError) {
      console.error('Google token verification failed:', verifyError.message);
      return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş Google token. Lütfen tekrar giriş yapın.' });
    }

    const payload = ticket.getPayload();
    const { email, given_name, family_name, picture } = payload;

    if (!email) {
      return res.status(400).json({ error: 'Google hesabında email bulunamadı.' });
    }

    // 2. Check if user already exists (race condition guard)
    const existingUser = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      // User was already created (possibly concurrent request) — log them in
      const user = existingUser.rows[0];
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, name: user.name },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );
      return res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar_url: user.avatar_url,
          auth_provider: user.auth_provider || 'google',
        },
      });
    }

    // 3. Check if student number is already taken by another account
    const studentNumberCheck = await client.query(
      'SELECT id, email FROM users WHERE student_number = $1',
      [trimmedStudentNumber]
    );
    if (studentNumberCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'Bu öğrenci numarası zaten başka bir hesap tarafından kullanılıyor.',
      });
    }

    // Begin transaction for user creation + pending enrollment resolution
    await client.query('BEGIN');

    // 4. Create the new user with student number
    const userId = uuidv4();
    const name = [given_name, family_name].filter(Boolean).join(' ') || email.split('@')[0];

    const insertResult = await client.query(
      `INSERT INTO users (id, name, email, password, role, student_number, avatar_url, auth_provider)
       VALUES ($1, $2, $3, NULL, 'student', $4, $5, 'google')
       RETURNING id, name, email, role, student_number, avatar_url, auth_provider, created_at`,
      [userId, name, email, trimmedStudentNumber, picture || null]
    );

    const user = insertResult.rows[0];

    // 5. Resolve pending enrollments — link this student to pre-assigned courses
    const pendingEnrollments = await client.query(
      'SELECT course_id, enrollment_type, is_mandatory FROM pending_enrollments WHERE student_number = $1',
      [trimmedStudentNumber]
    );

    let resolvedCourseCount = 0;
    for (const pe of pendingEnrollments.rows) {
      // Insert into course_students (skip if somehow already exists)
      await client.query(
        `INSERT INTO course_students (course_id, student_id, is_mandatory, enrollment_type)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (course_id, student_id) DO NOTHING`,
        [pe.course_id, userId, pe.is_mandatory, pe.enrollment_type]
      );
      resolvedCourseCount++;
    }

    // Remove the resolved pending enrollments
    if (resolvedCourseCount > 0) {
      await client.query(
        'DELETE FROM pending_enrollments WHERE student_number = $1',
        [trimmedStudentNumber]
      );
      console.log(`Resolved ${resolvedCourseCount} pending enrollment(s) for student ${trimmedStudentNumber}`);
    }

    await client.query('COMMIT');

    console.log(`New Google user registered: ${email} (student_number: ${trimmedStudentNumber})`);

    // 6. Generate internal JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        student_number: user.student_number,
        avatar_url: user.avatar_url,
        auth_provider: 'google',
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Register student error:', error.message, error.stack);
    return res.status(500).json({ error: 'Kayıt sırasında bir hata oluştu.' });
  } finally {
    client.release();
  }
};

const getMe = async (req, res) => {
  try {
    // Query fresh user data from database
    const result = await pool.query('SELECT id, name, email, role, student_number, avatar_url FROM users WHERE id = $1', [
      req.user.id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    return res.json(user);
  } catch (error) {
    console.error('Get me error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { login, googleLogin, registerStudent, getMe };

