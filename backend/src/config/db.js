const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'pothole_reporter',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: parseInt(process.env.DB_POOL_MAX) || 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error('Unexpected DB pool error', err);
});

async function connectDB() {
  const client = await pool.connect();
  try {
    // Verify PostGIS is installed
    await client.query('SELECT PostGIS_Version()');
    logger.info('Database connected (PostGIS ready)');
  } finally {
    client.release();
  }
}

/**
 * Execute a query, returning rows directly.
 */
async function query(sql, params) {
  const start = Date.now();
  const result = await pool.query(sql, params);
  const duration = Date.now() - start;
  if (duration > 500) {
    logger.warn(`Slow query (${duration}ms): ${sql.substring(0, 80)}`);
  }
  return result;
}

/**
 * Get a client for manual transaction management.
 */
async function getClient() {
  return pool.connect();
}

/**
 * Run a function inside a transaction, auto-committing or rolling back.
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { connectDB, query, getClient, withTransaction, pool };
