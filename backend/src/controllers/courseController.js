const { pool } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const createCourse = async (req, res) => {
  try {
    const {
      name,
      code,
      allowed_ssid,
      allowed_ip_range,
      allowed_latitude,
      allowed_longitude,
      allowed_radius_meters,
      total_sessions_planned,
    } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    // Only admin and teacher can create courses
    if (!['admin', 'teacher'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only admins and teachers can create courses' });
    }

    const courseId = uuidv4();
    const teacherId = req.user.id;

    const planned = Number.isInteger(Number(total_sessions_planned)) ? Number(total_sessions_planned) : 0;

    const result = await pool.query(
      `INSERT INTO courses (id, name, code, teacher_id, allowed_ssid, allowed_ip_range, allowed_latitude, allowed_longitude, allowed_radius_meters, total_sessions_planned)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        courseId,
        name,
        code,
        teacherId,
        allowed_ssid || null,
        allowed_ip_range || null,
        allowed_latitude || null,
        allowed_longitude || null,
        allowed_radius_meters || 100,
        planned,
      ]
    );

    const course = result.rows[0];
    return res.status(201).json({
      id: course.id,
      name: course.name,
      code: course.code,
      teacher_id: course.teacher_id,
      allowed_ssid: course.allowed_ssid,
      allowed_ip_range: course.allowed_ip_range,
      allowed_latitude: course.allowed_latitude,
      allowed_longitude: course.allowed_longitude,
      allowed_radius_meters: course.allowed_radius_meters,
      total_sessions_planned: course.total_sessions_planned || 0,
      created_at: course.created_at,
    });
  } catch (error) {
    console.error('Create course error:', error);
    if (error.code === '23505') {
      // Unique constraint violation (duplicate code)
      return res.status(400).json({ error: 'Course code already exists' });
    }
    return res.status(500).json({ error: 'Server error' });
  }
};

const getCourses = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.name, c.code, c.teacher_id, 
              u.name as teacher_name, c.allowed_ssid, c.allowed_ip_range, 
              c.allowed_latitude, c.allowed_longitude, c.allowed_radius_meters, 
              c.total_sessions_planned, c.created_at
       FROM courses c
       JOIN users u ON c.teacher_id = u.id
       ORDER BY c.created_at DESC`
    );

    const courses = result.rows.map((course) => ({
      id: course.id,
      name: course.name,
      code: course.code,
      teacher_id: course.teacher_id,
      teacher_name: course.teacher_name,
      allowed_ssid: course.allowed_ssid,
      allowed_ip_range: course.allowed_ip_range,
      allowed_latitude: course.allowed_latitude,
      allowed_longitude: course.allowed_longitude,
      allowed_radius_meters: course.allowed_radius_meters,
      total_sessions_planned: course.total_sessions_planned || 0,
      created_at: course.created_at,
    }));

    return res.json(courses);
  } catch (error) {
    console.error('Get courses error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT c.id, c.name, c.code, c.teacher_id, 
              u.name as teacher_name, c.allowed_ssid, c.allowed_ip_range, 
              c.allowed_latitude, c.allowed_longitude, c.allowed_radius_meters, 
              c.total_sessions_planned, c.created_at
       FROM courses c
       JOIN users u ON c.teacher_id = u.id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const row = result.rows[0];
    if (row) row.total_sessions_planned = row.total_sessions_planned || 0;
    return res.json(row);
  } catch (error) {
    console.error('Get course by id error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      code,
      allowed_ssid,
      allowed_ip_range,
      allowed_latitude,
      allowed_longitude,
      allowed_radius_meters,
      total_sessions_planned,
    } = req.body;

    // permission: only admin or teacher (and teacher must own course)
    if (!['admin', 'teacher'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only admins and teachers can update courses' });
    }

    const existing = await pool.query('SELECT teacher_id FROM courses WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Course not found' });
    if (req.user.role === 'teacher' && existing.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Teachers can only update their own courses' });
    }

    const planned = Number.isInteger(Number(total_sessions_planned)) ? Number(total_sessions_planned) : undefined;

    const result = await pool.query(
      `UPDATE courses SET name = $1, code = $2, allowed_ssid = $3, allowed_ip_range = $4, allowed_latitude = $5, allowed_longitude = $6, allowed_radius_meters = $7, total_sessions_planned = COALESCE($8, total_sessions_planned)
       WHERE id = $9 RETURNING *`,
      [
        name,
        code,
        allowed_ssid || null,
        allowed_ip_range || null,
        allowed_latitude || null,
        allowed_longitude || null,
        allowed_radius_meters || 100,
        planned,
        id,
      ]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Course not found' });

    const course = result.rows[0];
    return res.json({
      id: course.id,
      name: course.name,
      code: course.code,
      teacher_id: course.teacher_id,
      allowed_ssid: course.allowed_ssid,
      allowed_ip_range: course.allowed_ip_range,
      allowed_latitude: course.allowed_latitude,
      allowed_longitude: course.allowed_longitude,
      allowed_radius_meters: course.allowed_radius_meters,
      total_sessions_planned: course.total_sessions_planned || 0,
      created_at: course.created_at,
    });
  } catch (error) {
    console.error('Update course error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

const getCourseStudents = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Get registered students enrolled in this course
    const registeredResult = await pool.query(
      `SELECT u.id, u.name, u.email, u.student_number, cs.is_mandatory, cs.enrollment_type,
              'active' as status
       FROM users u
       JOIN course_students cs ON cs.student_id = u.id
       WHERE cs.course_id = $1
       ORDER BY u.name`,
      [id]
    );

    // 2. Get pending (not yet registered) students for this course
    const pendingResult = await pool.query(
      `SELECT pe.id as pending_id, pe.student_name as name, pe.student_number, 
              pe.is_mandatory, pe.enrollment_type,
              NULL as id, NULL as email,
              'pending' as status
       FROM pending_enrollments pe
       WHERE pe.course_id = $1
       ORDER BY pe.student_name`,
      [id]
    );

    // Combine both lists
    const allStudents = [...registeredResult.rows, ...pendingResult.rows];

    return res.json(allStudents);
  } catch (error) {
    console.error('Get course students error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

const ExcelJS = require('exceljs');

const exportAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Get course details
    const courseResult = await pool.query('SELECT * FROM courses WHERE id = $1', [id]);
    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    const course = courseResult.rows[0];

    // 2. Get sessions count
    const sessionsResult = await pool.query(
      'SELECT COUNT(*) as total FROM attendance_sessions WHERE course_id = $1',
      [id]
    );
    const totalSessions = parseInt(sessionsResult.rows[0].total || 0, 10);

    // 3. Get students and their attendance count
    const studentsResult = await pool.query(
      `SELECT 
        u.id, u.name, u.email, u.student_number,
        COUNT(a.id) as attended_count
       FROM course_students cs
       JOIN users u ON cs.student_id = u.id
       LEFT JOIN attendance_sessions s ON s.course_id = cs.course_id
       LEFT JOIN attendances a ON a.session_id = s.id AND a.student_id = cs.student_id AND a.is_valid = true
       WHERE cs.course_id = $1
       GROUP BY u.id, u.name, u.email, u.student_number`,
      [id]
    );

    const students = studentsResult.rows;

    // 4. Generate Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Yoklama Raporu');

    // Style definitions
    worksheet.columns = [
      { header: 'Öğrenci No', key: 'student_number', width: 20 },
      { header: 'Ad Soyad', key: 'name', width: 30 },
      { header: 'E-posta', key: 'email', width: 30 },
      { header: 'Toplam Ders', key: 'total', width: 15 },
      { header: 'Katıldığı', key: 'attended', width: 15 },
      { header: 'Katılım Oranı', key: 'rate', width: 20 },
    ];

    // Apply header styles
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1E3A5F' },
    };

    // Add data
    students.forEach((student) => {
      const attended = parseInt(student.attended_count || 0, 10);
      const rate = totalSessions > 0 ? (attended / totalSessions) * 100 : 0;

      worksheet.addRow({
        student_number: student.student_number || '-',
        name: student.name,
        email: student.email,
        total: totalSessions,
        attended: attended,
        rate: `%${rate.toFixed(2)}`,
      });
    });

    // Format rows alignment
    worksheet.eachRow((row, rowNumber) => {
      row.alignment = { vertical: 'middle', horizontal: 'center' };
      if (rowNumber > 1) {
        row.getCell('name').alignment = { vertical: 'middle', horizontal: 'left' };
        row.getCell('email').alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });

    // Set headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(course.code)}_Yoklama_Raporu.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Export attendance error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};



const importCourseStudents = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id: courseId } = req.params;
    const { students } = req.body;

    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: 'Students array is required and must not be empty' });
    }

    // Verify the course exists
    const courseCheck = await client.query('SELECT id FROM courses WHERE id = $1', [courseId]);
    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    await client.query('BEGIN');

    let enrolledCount = 0;   // Already-registered students linked directly
    let updatedCount = 0;    // Existing enrollments updated
    let pendingCount = 0;    // Students not yet registered → stored as pending
    let skippedCount = 0;    // Rows without student_number

    for (const student of students) {
      const { student_number, name, is_mandatory, enrollment_type } = student;

      if (!student_number) {
        skippedCount++;
        continue;
      }

      const trimmedNumber = String(student_number).trim();
      const studentName = name || `Öğrenci ${trimmedNumber}`;

      // Determine enrollment attributes
      const mandatory = typeof is_mandatory === 'boolean' ? is_mandatory : true;
      const enrollType = enrollment_type || (mandatory ? 'zorunlu' : 'alttan');

      // 1. Check if a registered user with this student_number exists
      const userCheck = await client.query(
        'SELECT id FROM users WHERE student_number = $1',
        [trimmedNumber]
      );

      if (userCheck.rows.length > 0) {
        // Student is registered — link them directly to the course
        const studentId = userCheck.rows[0].id;

        const enrollCheck = await client.query(
          'SELECT 1 FROM course_students WHERE course_id = $1 AND student_id = $2',
          [courseId, studentId]
        );

        if (enrollCheck.rows.length === 0) {
          await client.query(
            `INSERT INTO course_students (course_id, student_id, is_mandatory, enrollment_type)
             VALUES ($1, $2, $3, $4)`,
            [courseId, studentId, mandatory, enrollType]
          );
          enrolledCount++;
        } else {
          // Update existing enrollment with fresh status from Excel
          await client.query(
            `UPDATE course_students SET is_mandatory = $1, enrollment_type = $2
             WHERE course_id = $3 AND student_id = $4`,
            [mandatory, enrollType, courseId, studentId]
          );
          updatedCount++;
        }
      } else {
        // Student NOT registered yet — store as pending enrollment
        await client.query(
          `INSERT INTO pending_enrollments (course_id, student_number, student_name, enrollment_type, is_mandatory)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (course_id, student_number) DO UPDATE
           SET student_name = $3, enrollment_type = $4, is_mandatory = $5`,
          [courseId, trimmedNumber, studentName, enrollType, mandatory]
        );
        pendingCount++;
      }
    }

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      enrolled_count: enrolledCount,
      updated_count: updatedCount,
      pending_count: pendingCount,
      skipped_count: skippedCount,
      total: students.length,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Import course students error:', error);
    return res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};

const enrollStudents = async (req, res) => {
  try {
    const { id: courseId } = req.params;
    const { student_ids, is_mandatory } = req.body;

    if (!Array.isArray(student_ids)) {
      return res.status(400).json({ error: 'Student IDs must be an array' });
    }

    for (const studentId of student_ids) {
      await pool.query(
        `INSERT INTO course_students (course_id, student_id, is_mandatory)
         VALUES ($1, $2, $3)
         ON CONFLICT (course_id, student_id) DO UPDATE SET is_mandatory = $3`,
        [courseId, studentId, is_mandatory !== undefined ? is_mandatory : true]
      );
    }

    return res.status(200).json({ success: true, message: 'Students enrolled successfully' });
  } catch (error) {
    console.error('Enroll students error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

const deleteCourse = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const courseCheck = await client.query('SELECT id FROM courses WHERE id = $1', [id]);
    if (courseCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ders bulunamadı' });
    }

    // Step 1: Get all sessions for this course
    const sessions = await client.query(
      'SELECT id FROM attendance_sessions WHERE course_id = $1',
      [id]
    );

    // Step 2: Delete attendances for those sessions
    for (const session of sessions.rows) {
      await client.query('DELETE FROM attendances WHERE session_id = $1', [session.id]);
    }

    // Step 3: Delete sessions
    await client.query('DELETE FROM attendance_sessions WHERE course_id = $1', [id]);

    // Step 4: Delete course_students
    await client.query('DELETE FROM course_students WHERE course_id = $1', [id]);

    // Step 5: Delete pending_enrollments
    await client.query('DELETE FROM pending_enrollments WHERE course_id = $1', [id]);

    // Step 6: Delete course
    await client.query('DELETE FROM courses WHERE id = $1', [id]);

    await client.query('COMMIT');
    return res.status(200).json({ message: 'Ders silindi' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete course error:', error.message, error.detail);
    return res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};

module.exports = {
  createCourse,
  getCourses,
  getCourseById,
  getCourseStudents,
  exportAttendance,
  importCourseStudents,
  enrollStudents,
  updateCourse,
  deleteCourse,
};
