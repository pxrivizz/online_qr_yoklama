const { body, param, query } = require('express-validator');

const uuidParam = (name) => param(name).isUUID().withMessage(`${name} must be a valid UUID`);
const optionalText = (name, max) => body(name).optional({ nullable: true }).isString().trim().isLength({ max });

const courseId = [uuidParam('id')];
const coursePayload = [
  body('name').isString().trim().isLength({ min: 1, max: 150 }),
  body('code').isString().trim().isLength({ min: 1, max: 20 }).matches(/^[\p{L}\p{N}._-]+$/u),
  optionalText('allowed_ssid', 100),
  optionalText('allowed_ip_range', 50),
  body('allowed_latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body('allowed_longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
  body('allowed_radius_meters').optional().isInt({ min: 1, max: 100000 }).toInt(),
  body('total_sessions_planned').optional().isInt({ min: 0, max: 10000 }).toInt(),
];

const sessionId = [uuidParam('id')];
const sessionStart = [body('course_id').isUUID(), body('session_number').optional({ nullable: true }).isInt({ min: 1, max: 10000 }).toInt()];

const attendanceManual = [body('session_id').isUUID(), body('student_ids').isArray({ min: 1, max: 500 }), body('student_ids.*').isUUID()];
const attendanceToggle = [body('student_id').isUUID(), body('course_id').isUUID(), body('attendance_index').isInt({ min: 1, max: 10000 }).toInt()];

const userId = [uuidParam('id')];
const userCreate = [
  body('name').isString().trim().isLength({ min: 1, max: 100 }),
  body('email').isEmail().normalizeEmail().isLength({ max: 150 }),
  body('password').isString().isLength({ min: 8, max: 256 }),
  body('role').isIn(['admin', 'teacher', 'student']),
  body('student_number').optional({ nullable: true }).isString().trim().isLength({ max: 20 }),
];
const userUpdate = [
  ...userId,
  body('name').optional().isString().trim().isLength({ min: 1, max: 100 }),
  body('email').optional().isEmail().normalizeEmail().isLength({ max: 150 }),
  body('password').optional().isString().isLength({ min: 8, max: 256 }),
  body('role').optional().isIn(['admin', 'teacher', 'student']),
  body('student_number').optional({ nullable: true }).isString().trim().isLength({ max: 20 }),
];
const userList = [query('role').optional().isIn(['admin', 'teacher', 'student']), query('search').optional().isString().trim().isLength({ max: 100 })];

module.exports = {
  uuidParam,
  courseId,
  coursePayload,
  sessionId,
  sessionStart,
  attendanceManual,
  attendanceToggle,
  userId,
  userCreate,
  userUpdate,
  userList,
};
