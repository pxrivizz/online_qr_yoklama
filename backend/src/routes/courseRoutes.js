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

// Public route (any authenticated user can list courses)
router.get('/', authenticate, getCourses);

// Get course by ID
router.get('/:id', authenticate, getCourseById);

// Get students in a course
router.get('/:id/students', authenticate, getCourseStudents);

// Enroll students
router.post('/:id/enroll', authenticate, requireRole('admin', 'teacher'), enrollStudents);

// Export attendance to Excel
router.get('/:id/export-attendance', authenticate, requireRole('admin', 'teacher'), exportAttendance);

// Import students via Excel JSON payload
router.post('/:id/import-students', authenticate, requireRole('admin', 'teacher'), importCourseStudents);

// Generate session QR
const { generateSessionQR } = require('../controllers/sessionController');
router.post('/:courseId/sessions/:sessionNumber/generate', authenticate, requireRole('teacher', 'admin'), generateSessionQR);

// Protected route (only admin and teacher can create)
router.post('/', authenticate, requireRole('admin', 'teacher'), createCourse);

// Update course
router.put('/:id', authenticate, requireRole('admin', 'teacher'), updateCourse);

// Delete course
router.delete('/:id', authenticate, requireRole('admin', 'teacher'), deleteCourse);

module.exports = router;
