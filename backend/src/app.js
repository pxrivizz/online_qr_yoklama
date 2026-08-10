const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const courseRoutes = require('./routes/courseRoutes');
const userRoutes = require('./routes/userRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');

const app = express();

app.set('trust proxy', 1);

const rateLimit = require('express-rate-limit');
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true, standardHeaders: 'draft-8', legacyHeaders: false });
app.use('/api/', apiLimiter);

// Create uploads directory on startup
fs.mkdirSync(path.join(__dirname, '../../uploads/avatars'), { recursive: true });

// Middleware
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cors({
  origin: process.env.CORS_ORIGINS.split(',').map((value) => value.trim()),
  credentials: true
}));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/google', authLimiter);
app.use('/api/auth/register-student', authLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/attendance', attendanceRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((error, req, res, next) => {
  console.error('Unhandled request error:', error.code || error.name || 'UNKNOWN');
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large' });
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Uploaded file is too large' });
  if (error.name === 'MulterError') return res.status(400).json({ error: 'Invalid file upload' });
  return res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
