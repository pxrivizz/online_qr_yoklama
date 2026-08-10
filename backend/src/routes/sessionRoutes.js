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
const { param } = require('express-validator');
const { validate } = require('../middleware/validateMiddleware');
const { sessionId, sessionStart } = require('../middleware/requestValidators');

// All routes protected with authentication
router.use(authenticate);

// Start a new session (teacher, admin)
router.post('/start', requireRole('teacher', 'admin'), sessionStart, validate, startSession);

// Get all active sessions (authenticated users) - must be before /:id
router.get('/active', getActiveSessions);

// Get all sessions for a course (teacher, admin)
router.get('/course/:courseId', requireRole('teacher', 'admin'), param('courseId').isUUID(), validate, getCourseSessions);

// Get session by ID (teacher, admin)
router.get('/:id', requireRole('teacher', 'admin'), sessionId, validate, getSessionById);

// Refresh QR token for active session (teacher, admin)
router.put('/:id/refresh-qr', requireRole('teacher', 'admin'), sessionId, validate, refreshQRToken);

// End a session (teacher, admin)
router.put('/:id/end', requireRole('teacher', 'admin'), sessionId, validate, endSession);

// Get attendances for a session (teacher, admin)
router.get('/:id/attendances', requireRole('teacher', 'admin'), sessionId, validate, getSessionAttendances);

module.exports = router;
