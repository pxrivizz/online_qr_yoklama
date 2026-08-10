const { pool } = require('../config/db');
const qrService = require('../services/qrService');
const locationService = require('../services/locationService');

/**
 * Mark attendance for student with QR token and location/network validation
 */
async function markAttendance(req, res) {
  try {
    const { qr_token, latitude, longitude } = req.body;
    const studentId = req.user.id;

    // Validate required fields
    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);
    if (!qr_token || typeof qr_token !== 'string' || qr_token.length > 4096 || !Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude) || parsedLatitude < -90 || parsedLatitude > 90 || parsedLongitude < -180 || parsedLongitude > 180) {
      return res.status(400).json({
        error: 'Missing required fields: qr_token, latitude, longitude',
      });
    }

    // Check if student has uploaded a profile photo
    const { rows: [student] } = await pool.query('SELECT avatar_url FROM users WHERE id=$1', [req.user.id]);
    if (!student?.avatar_url) {
      return res.status(403).json({ success: false, rejection_reason: 'Profil fotoğrafı gerekli' });
    }

    // Step 1: Verify QR token
    let tokenPayload;
    try {
      tokenPayload = qrService.verifyQRToken(qr_token);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid or expired QR token' });
    }

    const sessionId = tokenPayload.sessionId;
    const clientIP = req.ip || 'unknown';

    // Step 2: Get session details
    const sessionResult = await pool.query(
      `SELECT s.id, s.is_active, s.course_id, s.qr_token as active_token, s.token_expires_at, c.allowed_ssid, c.allowed_ip_range,
              c.allowed_latitude, c.allowed_longitude, c.allowed_radius_meters
       FROM attendance_sessions s
       JOIN courses c ON s.course_id = c.id
       WHERE s.id = $1`,
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    if (!session.is_active) {
      return res.status(400).json({ error: 'Session is not active' });
    }

    if (new Date(session.token_expires_at).getTime() <= Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired QR token' });
    }

    if (session.active_token !== qr_token) {
      return res.status(400).json({ success: false, rejection_reason: 'QR kodu zaten kullanılmış veya süresi dolmuş' });
    }

    const enrollment = await pool.query(
      'SELECT 1 FROM course_students WHERE course_id = $1 AND student_id = $2',
      [session.course_id, studentId]
    );
    if (enrollment.rows.length === 0) {
      return res.status(403).json({ error: 'Student is not enrolled in this course' });
    }

    // Step 3: IP and VPN checks
    // Public IP addresses identify a network/NAT, not a physical device. Student identity
    // and the database uniqueness constraint provide the reliable duplicate protection.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    try {
      const vpnCheck = await fetch(`https://ipapi.co/${encodeURIComponent(clientIP)}/json/`, { signal: controller.signal });
      const ipData = await vpnCheck.json();
      if (ipData.threat?.is_vpn || ipData.threat?.is_proxy || ipData.threat?.is_tor) {
        return res.status(403).json({
          success: false,
          rejection_reason: 'VPN veya proxy kullanarak yoklama yapılamaz'
        });
      }
    } catch (error) {
      // If VPN check fails, continue (don't block)
      console.warn('VPN check unavailable');
    } finally {
      clearTimeout(timeout);
    }

    // Step 5: Validate network
    let isValidNetwork = true;
    if (session.allowed_ip_range) {
      const networkCheck = locationService.isWithinAllowedNetwork(
        clientIP,
        session.allowed_ip_range
      );
      isValidNetwork = networkCheck.valid;
    }

    if (!isValidNetwork) {
      // Insert invalid attendance record
      const resultInvalid = await pool.query(
        `INSERT INTO attendances (id, session_id, student_id, student_latitude, student_longitude, student_ip, is_valid, rejection_reason, marked_at)
         SELECT gen_random_uuid(), $1, $2, $3, $4, $5, false, $6, NOW()
         FROM attendance_sessions s WHERE s.id = $1 AND s.is_active = true AND s.qr_token = $7 AND s.token_expires_at > NOW()
         ON CONFLICT (session_id, student_id) DO UPDATE SET
           student_latitude = EXCLUDED.student_latitude, student_longitude = EXCLUDED.student_longitude,
           student_ip = EXCLUDED.student_ip, is_valid = false, rejection_reason = EXCLUDED.rejection_reason, marked_at = NOW()
         WHERE attendances.is_valid = false
         RETURNING id, is_valid, rejection_reason, marked_at`,
        [sessionId, studentId, parsedLatitude, parsedLongitude, clientIP, 'Outside allowed network', qr_token]
      );
      if (!resultInvalid.rows.length) return res.status(409).json({ error: 'Student has already marked attendance for this session' });

      return res.status(200).json({
        success: true,
        is_valid: false,
        rejection_reason: 'Outside allowed network',
        marked_at: resultInvalid.rows[0].marked_at,
      });
    }

    // Step 6: Validate location
    let isValidLocation = true;
    let locationReason = null;
    let actualDistance = null;

    if (
      session.allowed_latitude !== null &&
      session.allowed_longitude !== null
    ) {
      const locationCheck = locationService.isWithinAllowedLocation(
        parsedLatitude,
        parsedLongitude,
        session.allowed_latitude,
        session.allowed_longitude,
        session.allowed_radius_meters || 100
      );

      isValidLocation = locationCheck.valid;
      actualDistance = locationCheck.distance;

      if (!isValidLocation) {
        locationReason = `Outside allowed location (${actualDistance}m away)`;
      }
    }

    if (!isValidLocation) {
      // Insert invalid attendance record
      const resultInvalid = await pool.query(
        `INSERT INTO attendances (id, session_id, student_id, student_latitude, student_longitude, student_ip, is_valid, rejection_reason, marked_at)
         SELECT gen_random_uuid(), $1, $2, $3, $4, $5, false, $6, NOW()
         FROM attendance_sessions s WHERE s.id = $1 AND s.is_active = true AND s.qr_token = $7 AND s.token_expires_at > NOW()
         ON CONFLICT (session_id, student_id) DO UPDATE SET
           student_latitude = EXCLUDED.student_latitude, student_longitude = EXCLUDED.student_longitude,
           student_ip = EXCLUDED.student_ip, is_valid = false, rejection_reason = EXCLUDED.rejection_reason, marked_at = NOW()
         WHERE attendances.is_valid = false
         RETURNING id, is_valid, rejection_reason, marked_at`,
        [sessionId, studentId, parsedLatitude, parsedLongitude, clientIP, locationReason, qr_token]
      );
      if (!resultInvalid.rows.length) return res.status(409).json({ error: 'Student has already marked attendance for this session' });

      return res.status(200).json({
        success: true,
        is_valid: false,
        rejection_reason: locationReason,
        marked_at: resultInvalid.rows[0].marked_at,
      });
    }

    // Step 7: Mark valid attendance
    const resultValid = await pool.query(
      `INSERT INTO attendances (id, session_id, student_id, student_latitude, student_longitude, student_ip, is_valid, marked_at)
       SELECT gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW()
       FROM attendance_sessions s
       JOIN course_students cs ON cs.course_id = s.course_id AND cs.student_id = $2
       WHERE s.id = $1 AND s.is_active = true AND s.qr_token = $6 AND s.token_expires_at > NOW()
       ON CONFLICT (session_id, student_id) DO UPDATE SET
         student_latitude = EXCLUDED.student_latitude, student_longitude = EXCLUDED.student_longitude,
         student_ip = EXCLUDED.student_ip, is_valid = true, rejection_reason = null, marked_at = NOW()
       WHERE attendances.is_valid = false
       RETURNING id, is_valid, rejection_reason, marked_at`,
      [sessionId, studentId, parsedLatitude, parsedLongitude, clientIP, qr_token]
    );

    if (resultValid.rows.length === 0) {
      return res.status(409).json({ error: 'Student has already marked attendance for this session' });
    }

    return res.status(201).json({
      success: true,
      is_valid: true,
      rejection_reason: null,
      marked_at: resultValid.rows[0].marked_at,
    });
  } catch (error) {
    console.error('Error marking attendance:', error.code || error.name || 'UNKNOWN');
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get all attendance records for the logged-in student grouped by course
 */
async function getMyAttendances(req, res) {
  try {
    const studentId = req.user.id;

    const result = await pool.query(
      `SELECT 
        c.id as course_id,
        c.name as course_name,
        c.code as course_code,
        COUNT(DISTINCT s.id) as total_sessions,
        COUNT(DISTINCT a.id) FILTER (WHERE a.is_valid = true) as attended,
        ROUND(
          COUNT(DISTINCT a.id) FILTER (WHERE a.is_valid = true)::numeric / 
          NULLIF(COUNT(DISTINCT s.id)::numeric, 0) * 100, 2
        )::integer as attendance_percentage
       FROM courses c
       LEFT JOIN attendance_sessions s ON c.id = s.course_id
       LEFT JOIN course_students cs ON c.id = cs.course_id
       LEFT JOIN attendances a ON s.id = a.session_id AND a.student_id = $1
       WHERE cs.student_id = $1
       GROUP BY c.id, c.name, c.code
       ORDER BY c.name`,
      [studentId]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching student attendances:', error.code || error.name || 'UNKNOWN');
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get attendance summary for a course (teacher sees own courses, admin sees all)
 */
async function getAttendanceSummary(req, res) {
  try {
    const { course_id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Verify course ownership for teachers
    if (userRole === 'teacher') {
      const courseCheck = await pool.query(
        `SELECT teacher_id FROM courses WHERE id = $1`,
        [course_id]
      );

      if (
        courseCheck.rows.length === 0 ||
        courseCheck.rows[0].teacher_id !== userId
      ) {
        return res.status(403).json({
          error: 'You do not have permission to view this course',
        });
      }
    }

    const result = await pool.query(
      `SELECT
        u.id as student_id,
        u.name as student_name,
        u.student_number,
        cs.is_mandatory,
        COUNT(DISTINCT s.id) as total_sessions,
        COUNT(DISTINCT a.id) FILTER (WHERE a.is_valid = true) as attended,
        ROUND(
          COUNT(DISTINCT a.id) FILTER (WHERE a.is_valid = true)::numeric / 
          NULLIF(COUNT(DISTINCT s.id)::numeric, 0) * 100, 2
        )::integer as attendance_percentage
       FROM users u
       LEFT JOIN course_students cs ON u.id = cs.student_id
       LEFT JOIN attendance_sessions s ON cs.course_id = s.course_id
       LEFT JOIN attendances a ON s.id = a.session_id AND u.id = a.student_id
       WHERE cs.course_id = $1 AND u.role = 'student'
       GROUP BY u.id, u.name, u.student_number, cs.is_mandatory
       ORDER BY u.name`,
      [course_id]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching attendance summary:', error.code || error.name || 'UNKNOWN');
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function markManualAttendance(req, res) {
  try {
    const { session_id, student_ids } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!session_id || !Array.isArray(student_ids)) {
      return res.status(400).json({ error: 'Session ID and student IDs array are required' });
    }

    const sessionResult = await pool.query(
      'SELECT course_id, teacher_id FROM attendance_sessions WHERE id = $1',
      [session_id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    if (userRole === 'teacher' && session.teacher_id !== userId) {
      return res.status(403).json({ error: 'You do not have permission to update this session' });
    }

    const inserted = await pool.query(
      `INSERT INTO attendances (id, session_id, student_id, student_ip, is_valid, marked_at)
       SELECT gen_random_uuid(), $1, requested.student_id, 'manual', true, NOW()
       FROM unnest($2::uuid[]) AS requested(student_id)
       JOIN course_students cs ON cs.student_id = requested.student_id AND cs.course_id = $3
       ON CONFLICT (session_id, student_id) DO NOTHING
       RETURNING id`,
      [session_id, student_ids, session.course_id]
    );
    const marked_count = inserted.rowCount;
    const skipped_count = student_ids.length - marked_count;

    return res.status(200).json({ marked_count, skipped_count });
  } catch (error) {
    console.error('Error marking manual attendance:', error.code || error.name || 'UNKNOWN');
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getStudentAttendanceSummary(req, res) {
  try {
    const { course_id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Permission check
    if (userRole === 'teacher') {
      const courseCheck = await pool.query(
        `SELECT teacher_id FROM courses WHERE id = $1`,
        [course_id]
      );

      if (
        courseCheck.rows.length === 0 ||
        courseCheck.rows[0].teacher_id !== userId
      ) {
        return res.status(403).json({
          error: 'You do not have permission to view this course',
        });
      }
    }

    // Get total sessions planned
    const courseResult = await pool.query(
      `SELECT total_sessions_planned FROM courses WHERE id = $1`,
      [course_id]
    );
    
    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    const total_sessions_planned = courseResult.rows[0].total_sessions_planned || 0;

    // Get student attendance summary
    const result = await pool.query(
      `WITH enrollments AS (
        SELECT
          pe.course_id,
          pe.student_number,
          pe.student_name,
          pe.enrollment_type,
          pe.is_mandatory,
          0 as has_user
        FROM pending_enrollments pe
        WHERE pe.course_id = $1
        UNION ALL
        SELECT
          cs.course_id,
          u.student_number,
          u.name as student_name,
          cs.enrollment_type,
          cs.is_mandatory,
          1 as has_user
        FROM course_students cs
        JOIN users u ON u.id = cs.student_id
        WHERE cs.course_id = $1
      ),
      dedup_enrollments AS (
        SELECT DISTINCT ON (student_number)
          course_id,
          student_number,
          student_name,
          enrollment_type,
          is_mandatory
        FROM enrollments
        ORDER BY student_number, has_user DESC
      )
      SELECT 
        u.id as student_id,
        COALESCE(u.name, e.student_name) as name,
        COALESCE(u.student_number, e.student_number) as student_number,
        u.avatar_url,
        e.is_mandatory,
        e.enrollment_type,
        COALESCE(
          jsonb_agg(
            DISTINCT jsonb_build_object(
              'session_number', CASE
                WHEN s.qr_token LIKE 'manual_%' THEN NULLIF(split_part(s.qr_token, '_', 3), '')::integer
                ELSE s.session_number
              END,
              'status', CASE
                WHEN s.qr_token LIKE 'manual_%' THEN 'manual'
                ELSE 'qr'
              END
            )
          ) FILTER (WHERE a.id IS NOT NULL AND a.is_valid = true),
          '[]'::jsonb
        ) as attendances,
        ARRAY(
          SELECT CAST(split_part(s2.qr_token, '_', 3) AS INTEGER)
          FROM attendances a2
          JOIN attendance_sessions s2 ON s2.id = a2.session_id
          WHERE a2.student_id = u.id 
          AND s2.course_id = $1
          AND s2.qr_token LIKE 'manual_%'
          AND a2.is_valid = true
        ) as manual_indexes,
        COUNT(CASE WHEN s.qr_token NOT LIKE 'manual_%' AND a.is_valid = true THEN 1 END)::integer as qr_attended_count
      FROM dedup_enrollments e
      LEFT JOIN users u ON u.student_number = e.student_number
      LEFT JOIN attendance_sessions s ON s.course_id = e.course_id
      LEFT JOIN attendances a ON a.session_id = s.id AND a.student_id = u.id
      WHERE e.course_id = $1
      GROUP BY u.id, u.name, u.student_number, u.avatar_url, e.student_number, e.student_name, e.is_mandatory, e.enrollment_type
      ORDER BY COALESCE(u.name, e.student_name)`,
      [course_id]
    );

    const students = result.rows.map(row => {
      const attendances = Array.isArray(row.attendances) ? row.attendances : [];
      const manualIndexes = Array.isArray(row.manual_indexes) ? row.manual_indexes : [];
      return {
        id: row.student_id || null,
        name: row.name,
        student_number: row.student_number,
        avatar_url: row.avatar_url,
        is_mandatory: row.is_mandatory,
        enrollment_type: row.enrollment_type || (row.is_mandatory ? 'zorunlu' : 'alttan'),
        attendances,
        manual_indexes: manualIndexes,
        total_attended: attendances.length
      };
    });

    res.status(200).json({
      total_sessions_planned,
      students
    });
  } catch (error) {
    console.error('Error getting student attendance summary:', error.code || error.name || 'UNKNOWN');
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function toggleManualAttendance(req, res) {
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    const { student_id, course_id, attendance_index } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!student_id || !course_id || !attendance_index) {
      return res.status(400).json({ error: 'student_id, course_id, and attendance_index are required' });
    }

    // Check course ownership
    let teacherId = null;
    const courseCheck = await client.query(
      `SELECT c.teacher_id, EXISTS (
         SELECT 1 FROM course_students cs WHERE cs.course_id = c.id AND cs.student_id = $2
       ) AS is_enrolled
       FROM courses c WHERE c.id = $1`,
      [course_id, student_id]
    );

    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    teacherId = courseCheck.rows[0].teacher_id;

    if (userRole === 'teacher' && teacherId !== userId) {
      return res.status(403).json({
        error: 'You do not have permission to edit attendance for this course',
      });
    }
    if (!courseCheck.rows[0].is_enrolled) return res.status(400).json({ error: 'Student is not enrolled in this course' });

    await client.query('BEGIN');
    transactionStarted = true;

    const qrToken = `manual_${course_id}_${attendance_index}`;

    // Find or create manual session for this specific index
    const sessionResult = await client.query(
      `INSERT INTO attendance_sessions 
         (id, course_id, teacher_id, qr_token, token_expires_at, is_active)
       VALUES 
         (gen_random_uuid(), $1, $2, $3, NOW(), false)
       ON CONFLICT (qr_token) DO UPDATE SET qr_token = EXCLUDED.qr_token
       RETURNING id`,
      [course_id, teacherId, qrToken]
    );

    const sessionId = sessionResult.rows[0].id;
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${sessionId}:${student_id}`]);

    // Check if attendance exists for this student + session
    const attendanceCheck = await client.query(
      `SELECT id FROM attendances WHERE session_id = $1 AND student_id = $2`,
      [sessionId, student_id]
    );

    if (attendanceCheck.rows.length > 0) {
      // If exists: DELETE it (toggle off)
      await client.query(
        `DELETE FROM attendances WHERE session_id = $1 AND student_id = $2`,
        [sessionId, student_id]
      );
      await client.query('COMMIT');
      transactionStarted = false;
      return res.status(200).json({ attended: false });
    } else {
      // If not: INSERT it
      await client.query(
        `INSERT INTO attendances (id, session_id, student_id, student_ip, is_valid, marked_at)
         VALUES (gen_random_uuid(), $1, $2, 'manual', true, NOW())`,
        [sessionId, student_id]
      );
      await client.query('COMMIT');
      transactionStarted = false;
      return res.status(200).json({ attended: true });
    }
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK');
    console.error('Error toggling manual attendance:', error.code || error.name || 'UNKNOWN');
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

module.exports = {
  markAttendance,
  getMyAttendances,
  getAttendanceSummary,
  markManualAttendance,
  getStudentAttendanceSummary,
  toggleManualAttendance,
};
