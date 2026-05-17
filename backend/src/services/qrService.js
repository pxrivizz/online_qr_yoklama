const jwt = require('jsonwebtoken');

const generateQRToken = (sessionId, courseId, sessionNumber) => {
  const payload = { sessionId, type: 'qr' };
  if (courseId) payload.courseId = courseId;
  if (sessionNumber) payload.sessionNumber = sessionNumber;

  const token = jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: '30s' }
  );
  return token;
};

const verifyQRToken = (token) => {
  if (token && token.startsWith('used_')) {
    throw new Error('QR token has already been used');
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'qr') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (error) {
    throw new Error(`QR token verification failed: ${error.message}`);
  }
};

module.exports = { generateQRToken, verifyQRToken };
