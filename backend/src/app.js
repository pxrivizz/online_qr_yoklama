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

// Create uploads directory on startup
fs.mkdirSync(path.join(__dirname, '../../uploads/avatars'), { recursive: true });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://online-qr-yoklama.vercel.app'
  ],
  credentials: true
}));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/attendance', attendanceRoutes);

module.exports = app;
