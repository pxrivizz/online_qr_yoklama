const express = require('express');
const router = express.Router();
const {
	createCourse,
	getCourses,
	getCourseById,
	getCourseStudents,
	exportAttendance,
	importCourseStudents,
	enrollStudents,
	updateCourse,
	deleteCourse,
} = require('../controllers/courseController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const { requireCourseAccess } = require('../middleware/resourceAuthMiddleware');
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validateMiddleware');
const { courseId, coursePayload } = require('../middleware/requestValidators');

// Public route (any authenticated user can list courses)
router.get('/', authenticate, getCourses);

// Get course by ID
router.get('/:id', authenticate, courseId, validate, requireCourseAccess(), getCourseById);

// Get students in a course
router.get('/:id/students', authenticate, requireRole('admin', 'teacher'), courseId, validate, requireCourseAccess(), getCourseStudents);

// Enroll students
router.post('/:id/enroll', authenticate, requireRole('admin', 'teacher'), courseId, body('student_ids').isArray({ min: 1, max: 500 }), body('student_ids.*').isUUID(), body('is_mandatory').optional().isBoolean().toBoolean(), validate, requireCourseAccess({ write: true }), enrollStudents);

// Export attendance to Excel
router.get('/:id/export-attendance', authenticate, requireRole('admin', 'teacher'), courseId, validate, requireCourseAccess({ write: true }), exportAttendance);

// Import students via Excel JSON payload
router.post('/:id/import-students', authenticate, requireRole('admin', 'teacher'), courseId, body('students').isArray({ min: 1, max: 1000 }), body('students.*.student_number').isString().trim().isLength({ min: 1, max: 20 }), body('students.*.name').optional().isString().trim().isLength({ max: 100 }), body('students.*.is_mandatory').optional().isBoolean(), body('students.*.enrollment_type').optional().isIn(['zorunlu', 'alttan']), validate, requireCourseAccess({ write: true }), importCourseStudents);

// Generate session QR
const { generateSessionQR } = require('../controllers/sessionController');
router.post('/:courseId/sessions/:sessionNumber/generate', authenticate, requireRole('teacher', 'admin'), param('courseId').isUUID(), param('sessionNumber').isInt({ min: 1, max: 10000 }).toInt(), validate, generateSessionQR);

// Protected route (only admin and teacher can create)
router.post('/', authenticate, requireRole('admin', 'teacher'), coursePayload, validate, createCourse);

// Update course
router.put('/:id', authenticate, requireRole('admin', 'teacher'), courseId, coursePayload, validate, requireCourseAccess({ write: true }), updateCourse);

// Delete course
router.delete('/:id', authenticate, requireRole('admin', 'teacher'), courseId, validate, requireCourseAccess({ write: true }), deleteCourse);

module.exports = router;
