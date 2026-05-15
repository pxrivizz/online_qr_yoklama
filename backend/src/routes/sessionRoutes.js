const express = require('express');
const router = express.Router();
const {
  startSession,
  refreshQRToken,
  endSession,
  getSessionById,
  getActiveSessions,
  getSessionAttendances,
  getCourseSessions,
} = require('../controllers/sessionController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// All routes protected with authentication
router.use(authenticate);

// Start a new session (teacher, admin)
router.post('/start', requireRole('teacher', 'admin'), startSession);

// Get all active sessions (teacher, admin) - must be before /:id
router.get('/active', requireRole('teacher', 'admin'), getActiveSessions);

// Get all sessions for a course (teacher, admin)
router.get('/course/:courseId', requireRole('teacher', 'admin'), getCourseSessions);

// Get session by ID (teacher, admin)
router.get('/:id', requireRole('teacher', 'admin'), getSessionById);

// Refresh QR token for active session (teacher, admin)
router.put('/:id/refresh-qr', requireRole('teacher', 'admin'), refreshQRToken);

// End a session (teacher, admin)
router.put('/:id/end', requireRole('teacher', 'admin'), endSession);

// Get attendances for a session (teacher, admin)
router.get('/:id/attendances', requireRole('teacher', 'admin'), getSessionAttendances);

module.exports = router;
