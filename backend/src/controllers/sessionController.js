const { pool } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { generateQRToken } = require('../services/qrService');

const startSession = async (req, res) => {
  try {
    const { course_id } = req.body;

    if (!course_id) {
      return res.status(400).json({ error: 'course_id is required' });
    }

    // Check if there's already an active session for this course
    const activeCheck = await pool.query(
      'SELECT id FROM attendance_sessions WHERE course_id = $1 AND is_active = true',
      [course_id]
    );

    if (activeCheck.rows.length > 0) {
      return res.status(409).json({ error: 'An active session already exists for this course' });
    }

    // Verify the course exists and teacher owns it (if not admin)
    const courseCheck = await pool.query('SELECT teacher_id FROM courses WHERE id = $1', [course_id]);

    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const course = courseCheck.rows[0];

    if (req.user.role !== 'admin' && course.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: can only start sessions for your own courses' });
    }

    // Generate QR token
    const sessionId = uuidv4();
    const qrToken = generateQRToken(sessionId);
    const expiresAt = new Date(Date.now() + 30 * 1000);

    const result = await pool.query(
      `INSERT INTO attendance_sessions (id, course_id, teacher_id, qr_token, token_expires_at, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, course_id, teacher_id, qr_token, token_expires_at, started_at, is_active`,
      [sessionId, course_id, req.user.id, qrToken, expiresAt]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Start session error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

const refreshQRToken = async (req, res) => {
  try {
    const { id } = req.params;

    // Get the session
    const sessionCheck = await pool.query('SELECT * FROM attendance_sessions WHERE id = $1', [id]);

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionCheck.rows[0];

    // Verify session is active
    if (!session.is_active) {
      return res.status(400).json({ error: 'Session is not active' });
    }

    // Verify authorization (teacher of course or admin)
    if (req.user.role !== 'admin' && session.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: not your session' });
    }

    // Generate new QR token
    const qrToken = generateQRToken(id);
    const expiresAt = new Date(Date.now() + 30 * 1000);

    const result = await pool.query(
      'UPDATE attendance_sessions SET qr_token = $1, token_expires_at = $2 WHERE id = $3 RETURNING qr_token, token_expires_at',
      [qrToken, expiresAt, id]
    );

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Refresh QR token error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

const endSession = async (req, res) => {
  try {
    const { id } = req.params;

    // Get the session
    const sessionCheck = await pool.query('SELECT * FROM attendance_sessions WHERE id = $1', [id]);

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionCheck.rows[0];

    // Verify authorization (teacher of course or admin)
    if (req.user.role !== 'admin' && session.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: not your session' });
    }

    // End the session
    const result = await pool.query(
      'UPDATE attendance_sessions SET is_active = false, ended_at = now() WHERE id = $1 RETURNING id, course_id, teacher_id, qr_token, token_expires_at, started_at, ended_at, is_active',
      [id]
    );

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('End session error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

const getSessionById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get the session with course info
    const result = await pool.query(
      `SELECT s.id, s.course_id, s.teacher_id, s.qr_token, s.token_expires_at, s.started_at, s.ended_at, s.is_active,
              c.name as course_name, c.code as course_code,
              (SELECT COUNT(*) FROM attendances WHERE session_id = s.id) as attendance_count
       FROM attendance_sessions s
       JOIN courses c ON s.course_id = c.id
       WHERE s.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = result.rows[0];

    // Verify authorization (admin or teacher of course)
    if (req.user.role !== 'admin' && session.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return res.json(session);
  } catch (error) {
    console.error('Get session by ID error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

const getActiveSessions = async (req, res) => {
  try {
    let query = `SELECT s.id, s.course_id, s.teacher_id, s.qr_token, s.token_expires_at, s.started_at, s.is_active,
                        c.name as course_name, c.code as course_code,
                        u.name as teacher_name,
                        (SELECT COUNT(*) FROM attendances WHERE session_id = s.id) as attendance_count
                 FROM attendance_sessions s
                 JOIN courses c ON s.course_id = c.id
                 JOIN users u ON s.teacher_id = u.id
                 WHERE s.is_active = true`;
    const params = [];

    // If teacher, only show sessions for their courses
    if (req.user.role === 'teacher') {
      query += ' AND s.teacher_id = $1';
      params.push(req.user.id);
    }

    query += ' ORDER BY s.started_at DESC';

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (error) {
    console.error('Get active sessions error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

const getSessionAttendances = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify session exists and get teacher info
    const sessionCheck = await pool.query('SELECT teacher_id FROM attendance_sessions WHERE id = $1', [id]);

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionCheck.rows[0];

    // Verify authorization (admin or teacher of course)
    if (req.user.role !== 'admin' && session.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Get attendance records
    const result = await pool.query(
      `SELECT a.id, a.marked_at, a.student_ip, a.student_latitude, a.student_longitude, 
              a.is_valid, a.rejection_reason,
              u.name as student_name, u.student_number
       FROM attendances a
       JOIN users u ON a.student_id = u.id
       WHERE a.session_id = $1
       ORDER BY a.marked_at DESC`,
      [id]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('Get session attendances error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

const getCourseSessions = async (req, res) => {
  try {
    const { courseId } = req.params;

    const courseCheck = await pool.query('SELECT teacher_id FROM courses WHERE id = $1', [courseId]);
    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (req.user.role !== 'admin' && courseCheck.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await pool.query(
      `SELECT s.id, s.started_at, s.ended_at, s.is_active,
              (SELECT COUNT(*) FROM attendances WHERE session_id = s.id AND is_valid = true) as attendance_count
       FROM attendance_sessions s
       WHERE s.course_id = $1
       ORDER BY s.started_at DESC`,
      [courseId]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('Get course sessions error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  startSession,
  refreshQRToken,
  endSession,
  getSessionById,
  getActiveSessions,
  getSessionAttendances,
  getCourseSessions,
};
