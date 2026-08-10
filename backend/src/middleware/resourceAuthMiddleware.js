const { pool } = require('../config/db');

const requireCourseAccess = ({ write = false } = {}) => async (req, res, next) => {
  try {
    if (req.user.role === 'admin') return next();
    const courseId = req.params.id || req.params.courseId || req.params.course_id;
    const result = await pool.query('SELECT teacher_id FROM courses WHERE id = $1', [courseId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Course not found' });
    if (req.user.role === 'teacher' && result.rows[0].teacher_id === req.user.id) return next();
    if (!write && req.user.role === 'student') {
      const enrolled = await pool.query('SELECT 1 FROM course_students WHERE course_id = $1 AND student_id = $2', [courseId, req.user.id]);
      if (enrolled.rows.length) return next();
    }
    return res.status(403).json({ error: 'Forbidden' });
  } catch (error) {
    return next(error);
  }
};

module.exports = { requireCourseAccess };
