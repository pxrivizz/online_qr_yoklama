const { pool } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { generateQRToken } = require('../services/qrService');

const runQuery = async (label, text, values) => {
  console.log(`[DB QUERY] ${label}`, {
    text,
    values,
  });

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

    console.log('[UPSERT DEBUG] attendance_sessions startSession payload:', {
      id: sessionId,
      course_id,
      teacher_id: req.user.id,
      session_number: sessNum,
      qr_token: qrToken,
      qr_token_length: qrToken ? qrToken.length : 0,
      token_expires_at: expiresAt,
      is_active: true,
    });

    // UPSERT: If (course_id, session_number) exists, UPDATE it. Otherwise, INSERT it.
    const upsertQuery = `
      INSERT INTO attendance_sessions (id, course_id, teacher_id, session_number, qr_token, token_expires_at, is_active, started_at)
      VALUES ($1, $2, $3, $4, $5, $6, true, now())
      ON CONFLICT (course_id, session_number) DO UPDATE SET
        qr_token = $5,
        token_expires_at = $6,
        is_active = true,
        started_at = now(),
        ended_at = null,
        teacher_id = $3
      RETURNING id, course_id, teacher_id, session_number, qr_token, token_expires_at, started_at, is_active
    `;
    const upsertValues = [sessionId, course_id, req.user.id, sessNum, qrToken, expiresAt];
    
    console.log('[UPSERT DEBUG] Executing UPSERT with:', {
      sessionId,
      course_id,
      session_number: sessNum,
      teacher_id: req.user.id,
    });

    const result = await runQuery('startSession.upsertSession', upsertQuery, upsertValues);

    console.log('[UPSERT DEBUG] UPSERT result:', {
      rowCount: result.rows.length,
      returnedSession: result.rows[0],
    });

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Start session error:', error);
    return res.status(500).json({ message: error.message || 'Server error' });
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
        SET is_active = true, qr_token = $1, token_expires_at = $2, started_at = now(), ended_at = null
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
    console.error('Generate session QR error:', error);
    return res.status(500).json({ message: error.message || 'Database connection failed or server error' });
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

    console.log('attendance_sessions update payload (refreshQRToken):', {
      id,
      qr_token: qrToken,
      qr_token_length: qrToken ? qrToken.length : 0,
      token_expires_at: expiresAt,
    });

    const updateTokenQuery = 'UPDATE attendance_sessions SET qr_token = $1, token_expires_at = $2 WHERE id = $3 RETURNING qr_token, token_expires_at';
    const updateTokenValues = [qrToken, expiresAt, id];
    const result = await runQuery('refreshQRToken.updateToken', updateTokenQuery, updateTokenValues);

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
    console.error('End session error:', error);
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
    console.error('Get session by ID error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

const getActiveSessions = async (req, res) => {
  try {
    // --- AGGRESSIVE DB STATE LOGGING FOR STUDENTS ---
    if (req.user.role === 'student') {
      try {
        // LOG 1: All sessions with is_active = true (regardless of enrollment)
        const debugLog1Query = `SELECT * FROM attendance_sessions WHERE is_active = true`;
        const debugLog1Result = await runQuery('getActiveSessions.DEBUG_LOG_1_AllActiveSessions', debugLog1Query, []);
        console.log('\n╔════════════════════════════════════════════════════════════════╗');
        console.log('║ [DEBUG LOG 1] ALL SESSIONS WITH is_active = true IN DATABASE   ║');
        console.log('╚════════════════════════════════════════════════════════════════╝');
        if (debugLog1Result.rows.length === 0) {
          console.log('❌ NO ACTIVE SESSIONS FOUND IN DATABASE!');
          console.log('👉 This means the teacher NEVER clicked "Start Session" or the UPDATE failed silently.');
        } else {
          console.log(`✓ Found ${debugLog1Result.rows.length} active session(s):`);
          debugLog1Result.rows.forEach((row, idx) => {
            console.log(`  [${idx + 1}] Session ID: ${row.id}`);
            console.log(`      Course ID: ${row.course_id}`);
            console.log(`      Session#: ${row.session_number}`);
            console.log(`      QR Token: ${row.qr_token?.substring(0, 20)}...`);
            console.log(`      is_active: ${row.is_active} (Type: ${typeof row.is_active})`);
            console.log(`      Created: ${row.started_at}`);
          });
        }
        console.log('');

        // LOG 2: All courses this student is enrolled in
        const debugLog2Query = `SELECT course_id FROM course_students WHERE student_id = $1`;
        const debugLog2Result = await runQuery('getActiveSessions.DEBUG_LOG_2_StudentEnrollments', debugLog2Query, [req.user.id]);
        console.log('╔════════════════════════════════════════════════════════════════╗');
        console.log('║ [DEBUG LOG 2] COURSES THIS STUDENT IS ENROLLED IN              ║');
        console.log('╚════════════════════════════════════════════════════════════════╝');
        if (debugLog2Result.rows.length === 0) {
          console.log('❌ STUDENT NOT ENROLLED IN ANY COURSES!');
          console.log('👉 This explains why getActiveSessions returns [].');
          console.log('👉 The student needs to be added to course_students table.');
        } else {
          console.log(`✓ Student is enrolled in ${debugLog2Result.rows.length} course(s):`);
          debugLog2Result.rows.forEach((row, idx) => {
            console.log(`  [${idx + 1}] Course ID: ${row.course_id}`);
          });
        }
        console.log('');

        // LOG 3: Cross-check - active sessions for THIS STUDENT'S courses
        const debugLog3Query = `
          SELECT s.id, s.course_id, s.session_number, s.is_active, s.qr_token
          FROM attendance_sessions s
          JOIN course_students cs ON s.course_id = cs.course_id
          WHERE cs.student_id = $1
        `;
        const debugLog3Result = await runQuery('getActiveSessions.DEBUG_LOG_3_SessionsForStudentCourses', debugLog3Query, [req.user.id]);
        console.log('╔════════════════════════════════════════════════════════════════╗');
        console.log('║ [DEBUG LOG 3] SESSIONS IN STUDENT\'S ENROLLED COURSES (ANY STATE)║');
        console.log('╚════════════════════════════════════════════════════════════════╝');
        if (debugLog3Result.rows.length === 0) {
          console.log('❌ NO SESSIONS FOUND FOR THIS STUDENT\'S COURSES!');
          console.log('👉 The teacher has not created any sessions yet.');
        } else {
          console.log(`✓ Found ${debugLog3Result.rows.length} session(s) in student's courses:`);
          debugLog3Result.rows.forEach((row, idx) => {
            console.log(`  [${idx + 1}] Session ID: ${row.id}`);
            console.log(`      Course ID: ${row.course_id}`);
            console.log(`      is_active: ${row.is_active}`);
          });
        }
        console.log('════════════════════════════════════════════════════════════════\n');
      } catch (debugError) {
        console.error('[DEBUG ERROR] Failed to run diagnostic logs:', debugError.message);
      }
    }
    // -------------------------------------------------------

    let query = `SELECT s.id, s.course_id, s.teacher_id, s.session_number, s.qr_token, s.token_expires_at, s.started_at, s.is_active,
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
    } else if (req.user.role === 'student') {
      // For students, ONLY query sessions of courses they are actively enrolled in
      query += ` AND s.course_id IN (
        SELECT course_id FROM course_students WHERE student_id = $1
      )`;
      params.push(req.user.id);
    }

    query += ' ORDER BY s.started_at DESC';

    const result = await runQuery('getActiveSessions.sessionList', query, params);
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
    console.error('Get session attendances error:', error);
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
  generateSessionQR,
};
