const ExcelJS = require('exceljs');

const { v4: uuidv4 } = require('uuid');

/**
 * Export attendance records for a session to Excel
 * @param {string} sessionId - Session ID
 * @param {object} pool - Database pool
 * @returns {Promise<Buffer>} Excel workbook buffer
 */
async function exportAttendanceToExcel(sessionId, pool) {
  try {
    // Query attendance records with student info
    const result = await pool.query(
      `SELECT 
        u.student_number,
        u.name,
        u.email,
        a.marked_at,
        a.is_valid,
        a.rejection_reason
       FROM attendances a
       JOIN users u ON a.student_id = u.id
       WHERE a.session_id = $1
       ORDER BY u.student_number`,
      [sessionId]
    );

    const attendances = result.rows;

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Attendance');

    // Add header row
    const headerRow = worksheet.addRow([
      'Student Number',
      'Name',
      'Email',
      'Marked At',
      'Valid',
      'Rejection Reason',
    ]);

    // Style header row
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A5F' },
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'center' };

    // Set column widths
    worksheet.columns = [
      { width: 15 },
      { width: 20 },
      { width: 25 },
      { width: 20 },
      { width: 10 },
      { width: 30 },
    ];

    // Add data rows
    for (const attendance of attendances) {
      const row = worksheet.addRow([
        attendance.student_number,
        attendance.name,
        attendance.email,
        attendance.marked_at
          ? new Date(attendance.marked_at).toLocaleString()
          : '',
        attendance.is_valid ? 'Yes' : 'No',
        attendance.rejection_reason || '',
      ]);

      // Alternate row colors
      if (worksheet.lastRow.number % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF5F5F5' },
        };
      }
    }

    // Get buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    console.error('Error exporting attendance to Excel:', error);
    throw error;
  }
}

/**
 * Import students from Excel file and enroll in course
 * @param {Buffer} buffer - Excel file buffer
 * @param {string} courseId - Course ID to enroll students into
 * @param {object} pool - Database pool
 * @returns {Promise<Object>} { imported_count, skipped_count, errors[] }
 */
async function importStudentsFromExcel(buffer, courseId, pool) {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet(1);

    const results = {
      imported_count: 0,
      skipped_count: 0,
      errors: [],
    };

    const passwordHashes = [];
    const rows = [];

    // Parse Excel rows
    worksheet.eachRow((row, rowNumber) => {
      // Skip header row
      if (rowNumber === 1) return;

      const [name, email, password, student_number] = row.values?.slice(1) || [];

      if (!name || !email || !password || !student_number) {
        results.errors.push({
          row: rowNumber,
          error: 'Missing required fields: name, email, password, student_number',
        });
        results.skipped_count++;
        return;
      }

      rows.push({
        name,
        email,
        password,
        student_number,
      });
    });

    // Prepare insert values
    const insertPromises = rows.map((row) => {
      const userId = uuidv4();
      return {
        id: userId,
        name: row.name,
        email: row.email,
        password: row.password,
        student_number: row.student_number,
        role: 'student',
      };
    });

    // Upsert users (insert or ignore on duplicate email)
    for (const user of insertPromises) {
      try {
        const existingUser = await pool.query(
          `SELECT id FROM users WHERE email = $1`,
          [user.email]
        );

        let userId;
        if (existingUser.rows.length > 0) {
          userId = existingUser.rows[0].id;
          results.skipped_count++;
        } else {
          const insertResult = await pool.query(
            `INSERT INTO users (id, name, email, password, student_number, role)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [user.id, user.name, user.email, user.password, user.student_number, user.role]
          );
          userId = insertResult.rows[0].id;
          results.imported_count++;
        }

        // Enroll in course
        await pool.query(
          `INSERT INTO course_students (id, course_id, student_id)
           VALUES (gen_random_uuid(), $1, $2)
           ON CONFLICT DO NOTHING`,
          [courseId, userId]
        );
      } catch (error) {
        results.errors.push({
          email: user.email,
          error: error.message,
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Error importing students from Excel:', error);
    throw error;
  }
}

module.exports = {
  exportAttendanceToExcel,
  importStudentsFromExcel,
};
