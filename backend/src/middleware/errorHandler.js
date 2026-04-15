const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Operational (expected) errors
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      error: err.message,
      code:  err.code || null,
    });
  }

  // Multer file errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Image too large (max 10MB)' });
  }

  // Postgres unique violation
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Duplicate entry' });
  }

  // Unexpected errors — log and return generic message
  logger.error('Unhandled error', { message: err.message, stack: err.stack, url: req.url });
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = errorHandler;
