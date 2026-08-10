const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
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
const { body } = require('express-validator');
const { validate } = require('../middleware/validateMiddleware');
const { userId, userCreate, userUpdate, userList } = require('../middleware/requestValidators');

const fileFilter = (req, file, cb) => {
  if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Sadece resim dosyaları yüklenebilir'), false);
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

function detectImageExtension(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return '.jpg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return '.png';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return '.webp';
  return null;
}

// All routes protected with authentication
router.use(authenticate);

// Avatar upload (any authenticated user)
router.post('/avatar', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenmedi' });
    }

    const extension = detectImageExtension(req.file.buffer);
    if (!extension) return res.status(400).json({ error: 'Geçersiz resim dosyası' });

    const filename = `${req.user.id}_${Date.now()}${extension}`;
    await fs.writeFile(path.join(__dirname, '../../uploads/avatars', filename), req.file.buffer, { flag: 'wx' });
    const avatarUrl = `/uploads/avatars/${filename}`;

    await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [
      avatarUrl,
      req.user.id,
    ]);

    return res.json({ avatar_url: avatarUrl });
  } catch (error) {
    console.error('Avatar upload error:', error.code || error.name || 'UNKNOWN');
    return res.status(500).json({ error: 'Avatar yüklenirken hata oluştu' });
  }
});

// Get all users (admin only)
router.get('/', requireRole('admin'), userList, validate, getAllUsers);

// Bulk create students (admin only) - must be before /:id
router.post('/bulk', requireRole('admin'), body('students').isArray({ min: 1, max: 500 }), body('students.*.name').isString().trim().isLength({ min: 1, max: 100 }), body('students.*.email').isEmail().normalizeEmail(), body('students.*.password').isString().isLength({ min: 8, max: 256 }), body('students.*.student_number').optional({ nullable: true }).isString().trim().isLength({ max: 20 }), validate, bulkCreateStudents);

// Get user by ID
router.get('/:id', userId, validate, getUserById);

// Create user (admin only)
router.post('/', requireRole('admin'), userCreate, validate, createUser);

// Update user
router.put('/:id', userUpdate, validate, updateUser);

// Delete user (admin only)
router.delete('/:id', requireRole('admin'), userId, validate, deleteUser);

module.exports = router;
