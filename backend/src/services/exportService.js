const ExcelJS = require('exceljs');

const { sanitizeSpreadsheetCell } = require('./spreadsheetService');

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
        sanitizeSpreadsheetCell(attendance.student_number),
        sanitizeSpreadsheetCell(attendance.name),
        sanitizeSpreadsheetCell(attendance.email),
        attendance.marked_at
          ? new Date(attendance.marked_at).toLocaleString()
          : '',
        attendance.is_valid ? 'Yes' : 'No',
        sanitizeSpreadsheetCell(attendance.rejection_reason),
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
    console.error('Error exporting attendance to Excel:', error.code || error.name || 'UNKNOWN');
    throw error;
  }
}

module.exports = {
  exportAttendanceToExcel,
};
