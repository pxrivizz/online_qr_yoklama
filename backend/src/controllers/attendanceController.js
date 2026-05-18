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
    if (!qr_token || latitude === undefined || longitude === undefined) {
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
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';

    // Step 2: Get session details
    const sessionResult = await pool.query(
      `SELECT s.id, s.is_active, s.course_id, s.qr_token as active_token, c.allowed_ssid, c.allowed_ip_range, 
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

    if (session.active_token !== qr_token) {
      return res.status(400).json({ success: false, rejection_reason: 'QR kodu zaten kullanılmış veya süresi dolmuş' });
    }

    // Step 3: Check for duplicate attendance
    const duplicateResult = await pool.query(
      `SELECT id FROM attendances WHERE session_id = $1 AND student_id = $2`,
      [sessionId, studentId]
    );

    if (duplicateResult.rows.length > 0) {
      return res
        .status(409)
        .json({ error: 'Student has already marked attendance for this session' });
    }

    // Step 4: IP and VPN checks
    // 4a. Check if same student already attended from different IP
    const studentIPCheck = await pool.query(
      'SELECT student_ip FROM attendances WHERE session_id=$1 AND student_id=$2 AND is_valid=true',
      [session.id, req.user.id]
    );
    if (studentIPCheck.rows.length > 0 && studentIPCheck.rows[0].student_ip !== clientIP) {
      return res.status(403).json({
        success: false,
        rejection_reason: 'Farklı bir ağdan tekrar yoklama yapılamaz'
      });
    }

    // 4b. Check if different student already used this IP
    const ipCheck = await pool.query(
      'SELECT student_id FROM attendances WHERE session_id=$1 AND student_ip=$2 AND is_valid=true',
      [session.id, clientIP]
    );
    if (ipCheck.rows.length > 0 && ipCheck.rows[0].student_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        rejection_reason: 'Bu cihazdan zaten başka bir öğrenci yoklamaya katıldı'
      });
    }

    // 4c. Check VPN/proxy via external API
    try {
      const vpnCheck = await fetch(`https://ipapi.co/${clientIP}/json/`);
      const ipData = await vpnCheck.json();
      if (ipData.threat?.is_vpn || ipData.threat?.is_proxy || ipData.threat?.is_tor) {
        return res.status(403).json({
          success: false,
          rejection_reason: 'VPN veya proxy kullanarak yoklama yapılamaz'
        });
      }
    } catch (e) {
      // If VPN check fails, continue (don't block)
      console.log('VPN check skipped:', e.message);
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
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, false, $6, NOW())
         RETURNING id, is_valid, rejection_reason, marked_at`,
        [sessionId, studentId, latitude, longitude, clientIP, 'Outside allowed network']
      );

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
        latitude,
        longitude,
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
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, false, $6, NOW())
         RETURNING id, is_valid, rejection_reason, marked_at`,
        [sessionId, studentId, latitude, longitude, clientIP, locationReason]
      );

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
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW())
       RETURNING id, is_valid, rejection_reason, marked_at`,
      [sessionId, studentId, latitude, longitude, clientIP]
    );

    // Step 8: Invalidate the used QR token so it can't be reused
    await pool.query(
      "UPDATE attendance_sessions SET qr_token = $1, token_expires_at = now() WHERE id = $2",
      [`used_${Date.now()}`, session.id]
    );

    return res.status(201).json({
      success: true,
      is_valid: true,
      rejection_reason: null,
      marked_at: resultValid.rows[0].marked_at,
    });
  } catch (error) {
    console.error('Error marking attendance:', error);
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
    console.error('Error fetching student attendances:', error);
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
    console.error('Error fetching attendance summary:', error);
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

    let marked_count = 0;
    let skipped_count = 0;

    for (const studentId of student_ids) {
      const checkResult = await pool.query(
        'SELECT id FROM attendances WHERE session_id = $1 AND student_id = $2',
        [session_id, studentId]
      );

      if (checkResult.rows.length > 0) {
        skipped_count++;
        continue;
      }

      await pool.query(
        `INSERT INTO attendances (id, session_id, student_id, student_latitude, student_longitude, student_ip, is_valid, rejection_reason, marked_at)
         VALUES (gen_random_uuid(), $1, $2, null, null, 'manual', true, null, NOW())`,
        [session_id, studentId]
      );

      marked_count++;
    }

    return res.status(200).json({ marked_count, skipped_count });
  } catch (error) {
    console.error('Error marking manual attendance:', error);
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
      `SELECT 
        u.id as student_id,
        u.name,
        u.student_number,
        u.avatar_url,
        cs.is_mandatory,
        cs.enrollment_type,
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
      FROM users u
      JOIN course_students cs ON cs.student_id = u.id
      LEFT JOIN attendance_sessions s ON s.course_id = cs.course_id
      LEFT JOIN attendances a ON a.session_id = s.id AND a.student_id = u.id
      WHERE cs.course_id = $1
      GROUP BY u.id, u.name, u.student_number, u.avatar_url, cs.is_mandatory, cs.enrollment_type
      ORDER BY u.name`,
      [course_id]
    );

    const students = result.rows.map(row => {
      const attendances = Array.isArray(row.attendances) ? row.attendances : [];
      const manualIndexes = Array.isArray(row.manual_indexes) ? row.manual_indexes : [];
      return {
        id: row.student_id || row.id,
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
    console.error('Error getting student attendance summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function toggleManualAttendance(req, res) {
  try {
    const { student_id, course_id, attendance_index } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!student_id || !course_id || !attendance_index) {
      return res.status(400).json({ error: 'student_id, course_id, and attendance_index are required' });
    }

    // Check course ownership
    let teacherId = null;
    const courseCheck = await pool.query(
      `SELECT teacher_id FROM courses WHERE id = $1`,
      [course_id]
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

    const qrToken = `manual_${course_id}_${attendance_index}`;

    // Find or create manual session for this specific index
    let sessionResult = await pool.query(
      `INSERT INTO attendance_sessions 
         (id, course_id, teacher_id, qr_token, token_expires_at, is_active)
       VALUES 
         (gen_random_uuid(), $1, $2, $3, NOW(), false)
       ON CONFLICT (qr_token) DO NOTHING
       RETURNING id`,
      [course_id, teacherId, qrToken]
    );

    let sessionId;
    if (sessionResult.rows.length === 0) {
      const existing = await pool.query(
        `SELECT id FROM attendance_sessions WHERE qr_token = $1`,
        [qrToken]
      );
      sessionId = existing.rows[0].id;
    } else {
      sessionId = sessionResult.rows[0].id;
    }

    // Check if attendance exists for this student + session
    const attendanceCheck = await pool.query(
      `SELECT id FROM attendances WHERE session_id = $1 AND student_id = $2`,
      [sessionId, student_id]
    );

    if (attendanceCheck.rows.length > 0) {
      // If exists: DELETE it (toggle off)
      await pool.query(
        `DELETE FROM attendances WHERE session_id = $1 AND student_id = $2`,
        [sessionId, student_id]
      );
      return res.status(200).json({ attended: false });
    } else {
      // If not: INSERT it
      await pool.query(
        `INSERT INTO attendances (id, session_id, student_id, student_ip, is_valid, marked_at)
         VALUES (gen_random_uuid(), $1, $2, 'manual', true, NOW())`,
        [sessionId, student_id]
      );
      return res.status(200).json({ attended: true });
    }
  } catch (error) {
    console.error('Error toggling manual attendance:', error);
    return res.status(500).json({ error: 'Internal server error' });
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
