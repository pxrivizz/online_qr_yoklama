const express = require('express');
const router = express.Router();
const { login, googleLogin, registerStudent, getMe } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const { body } = require('express-validator');
const { validate } = require('../middleware/validateMiddleware');

// Public routes
router.post('/login', body('email').isEmail().normalizeEmail(), body('password').isString().isLength({ min: 1, max: 256 }), validate, login);
router.post('/google', body('credential').isString().isLength({ min: 20, max: 10000 }), validate, googleLogin);
router.post('/register-student', body('credential').isString().isLength({ min: 20, max: 10000 }), body('studentNumber').trim().isLength({ min: 1, max: 20 }).matches(/^[\p{L}\p{N}._-]+$/u), validate, registerStudent);

// Protected route
router.get('/me', authenticate, getMe);

module.exports = router;
