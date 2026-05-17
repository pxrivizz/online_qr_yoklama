const express = require('express');
const router = express.Router();
const { login, googleLogin, getMe } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

// Public routes
router.post('/login', login);
router.post('/google', googleLogin);

// Protected route
router.get('/me', authenticate, getMe);

module.exports = router;
