const jwt  = require('jsonwebtoken');
const { query } = require('../config/db');
const { AppError } = require('../utils/errors');

/**
 * Verify JWT and attach req.user.
 */
async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new AppError('Authentication required', 401);

  const token = header.slice(7);
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new AppError('Invalid or expired token', 401);
  }

  const { rows } = await query(
    'SELECT id, role, is_active FROM users WHERE id = $1', [decoded.sub]
  );
  if (!rows.length || !rows[0].is_active) throw new AppError('Account not found or suspended', 401);

  req.user = rows[0];
  next();
}

/**
 * Role-based access guard factory.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      throw new AppError('Insufficient permissions', 403);
    }
    next();
  };
}

const requireAdmin = requireRole('admin', 'supervisor');
const requireSuperAdmin = requireRole('admin');

/**
 * Attach device ID from fingerprint header if present.
 */
async function attachDevice(req, res, next) {
  const fingerprint = req.headers['x-device-fingerprint'];
  if (fingerprint && req.user) {
    const { rows } = await query(
      'SELECT id FROM user_devices WHERE fingerprint = $1 AND user_id = $2',
      [fingerprint, req.user.id]
    );
    req.deviceId = rows[0]?.id || null;
  }
  next();
}

module.exports = { authenticate, requireRole, requireAdmin, requireSuperAdmin, attachDevice };
