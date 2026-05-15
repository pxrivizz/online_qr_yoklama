const express = require('express');
const router = express.Router();
const { login, getMe } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

// Public route
router.post('/login', login);

// Protected route
router.get('/me', authenticate, getMe);

module.exports = router;
