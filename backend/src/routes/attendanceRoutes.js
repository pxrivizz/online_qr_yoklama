const express = require('express');
const multer = require('multer');
const router = express.Router();
const {
  markAttendance,
  getMyAttendances,
  getAttendanceSummary,
  markManualAttendance,
  getStudentAttendanceSummary,
  toggleManualAttendance,
} = require('../controllers/attendanceController');
const { exportAttendanceToExcel } = require('../services/exportService');
const { importEnrollmentFromExcel } = require('../services/importService');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const { pool } = require('../config/db');

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// All routes protected with authentication
router.use(authenticate);

/**
 * GET /api/attendance/grid/:course_id
 * Get visual attendance grid data
 * Teacher or Admin
 */
router.get('/grid/:course_id', requireRole('teacher', 'admin'), getStudentAttendanceSummary);

/**
 * POST /api/attendance/toggle
 * Toggle manual attendance
 * Teacher or Admin
 */
router.post('/toggle', requireRole('teacher', 'admin'), toggleManualAttendance);

/**
 * POST /api/attendance/mark
 * Mark attendance with QR token and location/network validation
 * Student only
 */
router.post('/mark', requireRole('student'), markAttendance);

/**
 * GET /api/attendance/my
 * Get all attendance records for logged-in student grouped by course
 * Student only
 */
router.get('/my', requireRole('student'), getMyAttendances);

/**
 * GET /api/attendance/summary/:course_id
 * Get per-student attendance summary for a course
 * Teacher (own course) or Admin
 */
router.get('/summary/:course_id', requireRole('teacher', 'admin'), getAttendanceSummary);

/**
 * POST /api/attendance/manual
 * Mark manual attendance without QR scanning
 * Teacher or Admin
 */
router.post('/manual', requireRole('teacher', 'admin'), markManualAttendance);

/**
 * GET /api/attendance/export/:session_id
 * Export attendance records to Excel file
 * Teacher (own session) or Admin
 */
router.get('/export/:session_id', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const { session_id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Verify session ownership for teachers
    if (userRole === 'teacher') {
      const sessionCheck = await pool.query(
        `SELECT teacher_id FROM attendance_sessions WHERE id = $1`,
        [session_id]
      );

      if (sessionCheck.rows.length === 0 || sessionCheck.rows[0].teacher_id !== userId) {
        return res
          .status(403)
          .json({ error: 'You do not have permission to export this session' });
      }
    }

    // Generate Excel file
    const buffer = await exportAttendanceToExcel(session_id, pool);

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename=attendance_${session_id}.xlsx`);

    // Send buffer
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting attendance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



/**
 * POST /api/attendance/import/excel/:course_id
 * Import students from Excel file and enroll in course with course_id from URL
 * Admin only
 */
router.post(
  '/import/excel/:course_id',
  requireRole('admin'),
  upload.single('file'),
  async (req, res) => {
    try {
      const { course_id } = req.params;

      if (!req.file) {
        return res.status(400).json({ error: 'Dosya yüklenmedi' });
      }

      // Verify course exists
      const courseCheck = await pool.query(`SELECT id FROM courses WHERE id = $1`, [course_id]);

      if (courseCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Ders bulunamadı' });
      }

      // Import students from Excel
      const results = await importEnrollmentFromExcel(req.file.buffer, course_id, pool);

      res.status(200).json(results);
    } catch (error) {
      console.error('Error importing enrollment from excel:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router;
