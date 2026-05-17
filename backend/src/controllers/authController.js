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
    let user;

    if (result.rows.length > 0) {
      // User exists — update their avatar if it changed
      user = result.rows[0];
      if (picture && user.avatar_url !== picture) {
        await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [picture, user.id]);
        user.avatar_url = picture;
      }
    } else {
      // 3. User doesn't exist — create new user with 'student' role
      const userId = uuidv4();
      const name = [given_name, family_name].filter(Boolean).join(' ') || email.split('@')[0];

      const insertResult = await pool.query(
        `INSERT INTO users (id, name, email, password, role, avatar_url, auth_provider)
         VALUES ($1, $2, $3, NULL, 'student', $4, 'google')
         RETURNING id, name, email, role, student_number, avatar_url, auth_provider, created_at`,
        [userId, name, email, picture || null]
      );

      user = insertResult.rows[0];
      console.log(`New Google user created: ${email} (role: student)`);
    }

    // 4. Generate internal JWT for the application
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
  } catch (error) {
    console.error('Google login error:', error.message, error.stack);
    return res.status(500).json({ error: 'Google ile giriş sırasında bir hata oluştu.' });
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

module.exports = { login, googleLogin, getMe };

