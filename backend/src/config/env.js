function requireEnv(name, minimumLength = 1) {
  const value = process.env[name];
  if (!value || value.length < minimumLength) throw new Error(`${name} must be configured${minimumLength > 1 ? ` and at least ${minimumLength} characters` : ''}`);
  return value;
}

function requireInteger(name, { min, max }) {
  const value = Number(requireEnv(name));
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer between ${min} and ${max}`);
}

function requireSecret(name) {
  const value = requireEnv(name, 32);
  if (/replace|change|secret|password/i.test(value) || new Set(value).size < 12) {
    throw new Error(`${name} must be a cryptographically random value with sufficient character diversity`);
  }
  return value;
}

function validateEnvironment() {
  const jwtSecret = requireSecret('JWT_SECRET');
  const qrSecret = requireSecret('QR_SECRET');
  if (jwtSecret === qrSecret) throw new Error('JWT_SECRET and QR_SECRET must be different');
  requireEnv('DB_HOST');
  requireInteger('DB_PORT', { min: 1, max: 65535 });
  requireEnv('DB_NAME');
  requireEnv('DB_USER');
  requireEnv('DB_PASSWORD');
  requireEnv('GOOGLE_CLIENT_ID');
  if (process.env.JWT_EXPIRES_IN && !/^\d+(s|m|h|d)$/.test(process.env.JWT_EXPIRES_IN)) throw new Error('JWT_EXPIRES_IN must use a value such as 30m, 8h, or 7d');
  const origins = requireEnv('CORS_ORIGINS').split(',').map((value) => value.trim()).filter(Boolean);
  if (!origins.length || origins.includes('*') || origins.some((origin) => !/^https?:\/\/[^/]+(?::\d+)?$/.test(origin))) {
    throw new Error('CORS_ORIGINS must contain comma-separated explicit HTTP(S) origins and cannot include *');
  }
  if (process.env.DB_SSL !== undefined && !['true', 'false'].includes(process.env.DB_SSL)) throw new Error('DB_SSL must be true or false');
  if (process.env.DB_SSL_REJECT_UNAUTHORIZED !== undefined && !['true', 'false'].includes(process.env.DB_SSL_REJECT_UNAUTHORIZED)) throw new Error('DB_SSL_REJECT_UNAUTHORIZED must be true or false');
}

module.exports = { validateEnvironment };
