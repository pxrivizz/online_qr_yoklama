const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ quiet: true });

const useSsl = process.env.DB_SSL === 'true';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 10000),
  statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS || 15000),
  ssl: useSsl ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : false,
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error.code || 'UNKNOWN');
});

const initializeDatabase = async () => {
  try {
    const schemaPath = path.join(__dirname, '../models/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error.code || 'UNKNOWN');
    throw error;
  }
};

module.exports = { pool, initializeDatabase };
