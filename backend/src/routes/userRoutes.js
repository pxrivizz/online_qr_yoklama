const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { pool } = require('../config/db');
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  bulkCreateStudents,
} = require('../controllers/userController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// Multer config for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/avatars'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user.id}_${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Sadece resim dosyaları yüklenebilir'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// All routes protected with authentication
router.use(authenticate);

// Avatar upload (any authenticated user)
router.post('/avatar', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenmedi' });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [
      avatarUrl,
      req.user.id,
    ]);

    return res.json({ avatar_url: avatarUrl });
  } catch (error) {
    console.error('Avatar upload error:', error);
    return res.status(500).json({ error: 'Avatar yüklenirken hata oluştu' });
  }
});

// Get all users (admin only)
router.get('/', requireRole('admin'), getAllUsers);

// Bulk create students (admin only) - must be before /:id
router.post('/bulk', requireRole('admin'), bulkCreateStudents);

// Get user by ID
router.get('/:id', getUserById);

// Create user (admin only)
router.post('/', requireRole('admin'), createUser);

// Update user
router.put('/:id', updateUser);

// Delete user (admin only)
router.delete('/:id', requireRole('admin'), deleteUser);

module.exports = router;
