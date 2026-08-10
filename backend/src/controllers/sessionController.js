const { pool } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { generateQRToken } = require('../services/qrService');

const runQuery = async (label, text, values) => {
  return pool.query(text, values);
};

const startSession = async (req, res) => {
  try {
    const { course_id, session_number } = req.body;

    if (!course_id) {
      return res.status(400).json({ error: 'course_id is required' });
    }

    // Verify the course exists and teacher owns it (if not admin)
    const courseCheckQuery = 'SELECT teacher_id, total_sessions_planned FROM courses WHERE id = $1';
    const courseCheckValues = [course_id];
    const courseCheck = await runQuery('startSession.courseCheck', courseCheckQuery, courseCheckValues);

    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const course = courseCheck.rows[0];

    if (req.user.role !== 'admin' && course.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: can only start sessions for your own courses' });
    }

    // Validate session_number if provided
    const sessNum = session_number ? parseInt(session_number, 10) : null;

    if (sessNum !== null) {
      if (isNaN(sessNum) || sessNum < 1) {
        return res.status(400).json({ error: 'session_number must be a positive integer' });
      }

      const totalPlanned = course.total_sessions_planned || 0;
      if (totalPlanned > 0 && sessNum > totalPlanned) {
        return res.status(400).json({ error: `session_number (${sessNum}) exceeds total planned sessions (${totalPlanned})` });
      }

      // Check if a completed (non-manual) session already exists for this session_number
      const existingSessionQuery = `SELECT id FROM attendance_sessions 
         WHERE course_id = $1 AND session_number = $2 AND qr_token NOT LIKE 'manual_%'`;
      const existingSessionValues = [course_id, sessNum];
      const existingSession = await runQuery('startSession.existingSession', existingSessionQuery, existingSessionValues);

      if (existingSession.rows.length > 0) {
        return res.status(409).json({ error: `Bu ders için ${sessNum}. yoklama oturumu zaten oluşturulmuş` });
      }
    }

    // Generate QR token with courseId and sessionNumber embedded
    const sessionId = uuidv4();
    const qrToken = generateQRToken(sessionId, course_id, sessNum);
    const expiresAt = new Date(Date.now() + 30 * 1000);

    // A unique database index protects this check against concurrent starts.
    const upsertQuery = `
      INSERT INTO attendance_sessions (id, course_id, teacher_id, session_number, qr_token, token_expires_at, is_active, started_at)
      VALUES ($1, $2, $3, $4, $5, $6, true, now())
      RETURNING id, course_id, teacher_id, session_number, qr_token, token_expires_at, started_at, is_active
    `;
    const upsertValues = [sessionId, course_id, req.user.id, sessNum, qrToken, expiresAt];

    const result = await runQuery('startSession.upsertSession', upsertQuery, upsertValues);

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Start session error:', error.code || error.name || 'UNKNOWN');
    if (error.code === '23505') return res.status(409).json({ error: 'An active or numbered session already exists for this course' });
    return res.status(500).json({ error: 'Server error' });
  }
};

const generateSessionQR = async (req, res) => {
  try {
    const { courseId, sessionNumber } = req.params;

    if (!courseId) {
      return res.status(400).json({ message: 'courseId is required' });
    }

    const sessNum = sessionNumber ? parseInt(sessionNumber, 10) : null;
    if (sessNum === null || isNaN(sessNum) || sessNum < 1) {
      return res.status(400).json({ message: 'Valid sessionNumber is required in URL' });
    }

    // Check if there's already an active session for this course
    const activeCheckQuery = 'SELECT id FROM attendance_sessions WHERE course_id = $1 AND is_active = true';
    const activeCheckValues = [courseId];
    const activeCheck = await runQuery('generateSessionQR.activeCheck', activeCheckQuery, activeCheckValues);

    if (activeCheck.rows.length > 0) {
      return res.status(409).json({ message: 'An active session already exists for this course' });
    }

    // Verify the course exists and teacher owns it (if not admin)
    const courseCheckQuery = 'SELECT teacher_id, total_sessions_planned FROM courses WHERE id = $1';
    const courseCheckValues = [courseId];
    const courseCheck = await runQuery('generateSessionQR.courseCheck', courseCheckQuery, courseCheckValues);

    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const course = courseCheck.rows[0];

    if (req.user.role !== 'admin' && course.teacher_id !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: can only start sessions for your own courses' });
    }

    const totalPlanned = course.total_sessions_planned || 0;
    if (totalPlanned > 0 && sessNum > totalPlanned) {
      return res.status(400).json({ message: `sessionNumber (${sessNum}) exceeds total planned sessions (${totalPlanned})` });
    }

    // Check if a session already exists for this session_number
    const existingSessionQuery = `SELECT id FROM attendance_sessions WHERE course_id = $1 AND session_number = $2`;
    const existingSessionValues = [courseId, sessNum];
    const existingSession = await runQuery('generateSessionQR.existingSession', existingSessionQuery, existingSessionValues);

    let sessionId;
    if (existingSession.rows.length > 0) {
      sessionId = existingSession.rows[0].id;
    } else {
      sessionId = uuidv4();
    }

    // Generate QR token with courseId and sessionNumber embedded
    const qrToken = generateQRToken(sessionId, courseId, sessNum);
    const expiresAt = new Date(Date.now() + 30 * 1000);

    let result;
    if (existingSession.rows.length > 0) {
      // UPDATE EXISTING ROW
      const updateSessionQuery = `
        UPDATE attendance_sessions 
        SET is_active = true,
            qr_token = $1,
            token_expires_at = $2,
            started_at = COALESCE(started_at, now()),
            ended_at = null
        WHERE id = $3
        RETURNING id, course_id, teacher_id, session_number, qr_token, token_expires_at, started_at, is_active
      `;
      result = await runQuery('generateSessionQR.updateSession', updateSessionQuery, [qrToken, expiresAt, sessionId]);
    } else {
      // INSERT NEW ROW
      const insertSessionQuery = `
        INSERT INTO attendance_sessions (id, course_id, teacher_id, session_number, qr_token, token_expires_at, is_active, started_at)
        VALUES ($1, $2, $3, $4, $5, $6, true, now())
        RETURNING id, course_id, teacher_id, session_number, qr_token, token_expires_at, started_at, is_active
      `;
      result = await runQuery('generateSessionQR.insertSession', insertSessionQuery, [sessionId, courseId, req.user.id, sessNum, qrToken, expiresAt]);
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Generate session QR error:', error.code || error.name || 'UNKNOWN');
    if (error.code === '23505') return res.status(409).json({ error: 'An active or numbered session already exists for this course' });
    return res.status(500).json({ error: 'Server error' });
  }
};

const refreshQRToken = async (req, res) => {
  try {
    const { id } = req.params;

    // Get the session
    const sessionCheckQuery = 'SELECT * FROM attendance_sessions WHERE id = $1';
    const sessionCheckValues = [id];
    const sessionCheck = await runQuery('refreshQRToken.sessionCheck', sessionCheckQuery, sessionCheckValues);

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

    // Generate new QR token with courseId and sessionNumber
    const qrToken = generateQRToken(id, session.course_id, session.session_number);
    const expiresAt = new Date(Date.now() + 30 * 1000);

    const updateTokenQuery = `
      UPDATE attendance_sessions
      SET qr_token = $1,
          token_expires_at = $2,
          is_active = true,
          started_at = COALESCE(started_at, now()),
          ended_at = null
      WHERE id = $3
      RETURNING id, course_id, teacher_id, session_number, qr_token, token_expires_at, started_at, ended_at, is_active
    `;
    const updateTokenValues = [qrToken, expiresAt, id];
    const result = await runQuery('refreshQRToken.updateToken', updateTokenQuery, updateTokenValues);

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Refresh QR token error:', error.code || error.name || 'UNKNOWN');
    return res.status(500).json({ error: 'Server error' });
  }
};

const endSession = async (req, res) => {
  try {
    const { id } = req.params;

    // Get the session
    const sessionCheckQuery = 'SELECT * FROM attendance_sessions WHERE id = $1';
    const sessionCheckValues = [id];
    const sessionCheck = await runQuery('endSession.sessionCheck', sessionCheckQuery, sessionCheckValues);

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionCheck.rows[0];

    // Verify authorization (teacher of course or admin)
    if (req.user.role !== 'admin' && session.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: not your session' });
    }

    // End the session
    const endSessionQuery = 'UPDATE attendance_sessions SET is_active = false, ended_at = now() WHERE id = $1 RETURNING id, course_id, teacher_id, session_number, qr_token, token_expires_at, started_at, ended_at, is_active';
    const endSessionValues = [id];
    const result = await runQuery('endSession.endSession', endSessionQuery, endSessionValues);

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('End session error:', error.code || error.name || 'UNKNOWN');
    return res.status(500).json({ error: 'Server error' });
  }
};

const getSessionById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get the session with course info
    const sessionQuery = `SELECT s.id, s.course_id, s.teacher_id, s.session_number, s.qr_token, s.token_expires_at, s.started_at, s.ended_at, s.is_active,
              c.name as course_name, c.code as course_code,
              (SELECT COUNT(*) FROM attendances WHERE session_id = s.id) as attendance_count
       FROM attendance_sessions s
       JOIN courses c ON s.course_id = c.id
       WHERE s.id = $1`;
    const sessionValues = [id];
    const result = await runQuery('getSessionById.session', sessionQuery, sessionValues);

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
    console.error('Get session by ID error:', error.code || error.name || 'UNKNOWN');
    return res.status(500).json({ error: 'Server error' });
  }
};

const getActiveSessions = async (req, res) => {
  try {
    const query = req.user.role === 'admin'
      ? `SELECT id, course_id, session_number, is_active FROM attendance_sessions WHERE is_active = true ORDER BY started_at DESC`
      : req.user.role === 'teacher'
        ? `SELECT id, course_id, session_number, is_active FROM attendance_sessions WHERE is_active = true AND teacher_id = $1 ORDER BY started_at DESC`
        : `SELECT s.id, s.course_id, s.session_number, s.is_active
           FROM attendance_sessions s
           JOIN course_students cs ON cs.course_id = s.course_id
           WHERE s.is_active = true AND cs.student_id = $1
           ORDER BY s.started_at DESC`;
    const values = req.user.role === 'admin' ? [] : [req.user.id];
    const result = await runQuery('getActiveSessions', query, values);
    return res.json(result.rows);
  } catch (error) {
    console.error('Get active sessions error:', error.code || error.name || 'UNKNOWN');
    return res.status(500).json({ error: 'Server error' });
  }
};

const getSessionAttendances = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify session exists and get teacher info
    const sessionCheckQuery = 'SELECT teacher_id FROM attendance_sessions WHERE id = $1';
    const sessionCheckValues = [id];
    const sessionCheck = await runQuery('getSessionAttendances.sessionCheck', sessionCheckQuery, sessionCheckValues);

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionCheck.rows[0];

    // Verify authorization (admin or teacher of course)
    if (req.user.role !== 'admin' && session.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Get attendance records
    const attendanceQuery = `SELECT a.id, a.marked_at, a.student_ip, a.student_latitude, a.student_longitude, 
              a.is_valid, a.rejection_reason,
              u.name as student_name, u.student_number
       FROM attendances a
       JOIN users u ON a.student_id = u.id
       WHERE a.session_id = $1
       ORDER BY a.marked_at DESC`;
    const attendanceValues = [id];
    const result = await runQuery('getSessionAttendances.records', attendanceQuery, attendanceValues);

    return res.json(result.rows);
  } catch (error) {
    console.error('Get session attendances error:', error.code || error.name || 'UNKNOWN');
    return res.status(500).json({ error: 'Server error' });
  }
};

const getCourseSessions = async (req, res) => {
  try {
    const { courseId } = req.params;

    const courseCheckQuery = 'SELECT teacher_id FROM courses WHERE id = $1';
    const courseCheckValues = [courseId];
    const courseCheck = await runQuery('getCourseSessions.courseCheck', courseCheckQuery, courseCheckValues);
    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (req.user.role !== 'admin' && courseCheck.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const courseSessionsQuery = `SELECT s.id, s.session_number, s.started_at, s.ended_at, s.is_active,
              (SELECT COUNT(*) FROM attendances WHERE session_id = s.id AND is_valid = true) as attendance_count
       FROM attendance_sessions s
       WHERE s.course_id = $1 AND s.qr_token NOT LIKE 'manual_%'
       ORDER BY s.session_number ASC NULLS LAST, s.started_at DESC`;
    const courseSessionsValues = [courseId];
    const result = await runQuery('getCourseSessions.sessionList', courseSessionsQuery, courseSessionsValues);

    return res.json(result.rows);
  } catch (error) {
    console.error('Get course sessions error:', error.code || error.name || 'UNKNOWN');
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
  generateSessionQR,
};
