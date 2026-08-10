const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);
const PREFIX = 'scrypt';

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64);
  return `${PREFIX}$${salt}$${derived.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  if (!stored) return { valid: false, needsUpgrade: false };
  if (!stored.startsWith(`${PREFIX}$`)) {
    const valid = String(password) === String(stored);
    return { valid, needsUpgrade: valid };
  }
  const [, salt, expectedHex] = stored.split('$');
  if (!salt || !expectedHex) return { valid: false, needsUpgrade: false };
  const actual = await scrypt(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return { valid: actual.length === expected.length && crypto.timingSafeEqual(actual, expected), needsUpgrade: false };
}

module.exports = { hashPassword, verifyPassword };
