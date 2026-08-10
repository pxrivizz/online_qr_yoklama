const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }

  let decoded;
  try {
    const token = authHeader.substring(7);
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'qr-attend-api', audience: 'qr-attend-client' });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const result = await pool.query('SELECT id, email, role, name FROM users WHERE id = $1', [decoded.id]);
    if (!result.rows.length) return res.status(401).json({ error: 'Invalid token' });
    req.user = result.rows[0];
    return next();
  } catch (error) {
    return next(error);
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Missing token' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
    }

    next();
  };
};

module.exports = { authenticate, requireRole };
