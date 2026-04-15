const { RateLimiterRedis } = require('rate-limiter-flexible');
const rateLimit = require('express-rate-limit');
const { getRedis } = require('../config/redis');
const { AppError } = require('../utils/errors');

// Global HTTP rate limiter (express-rate-limit, in-memory fallback)
const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: 'Too many requests' }),
});

// Per-IP limiter backed by Redis
let ipLimiter;
function getIpLimiter() {
  if (!ipLimiter) {
    ipLimiter = new RateLimiterRedis({
      storeClient: getRedis(),
      keyPrefix:   'rl:global:ip',
      points:      100,
      duration:    60,
    });
  }
  return ipLimiter;
}

const reportSubmitLimiter = async (req, res, next) => {
  try {
    await getIpLimiter().consume(req.ip);
    next();
  } catch {
    next(new AppError('Rate limit exceeded', 429));
  }
};

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.body?.phone || req.ip,
  handler: (req, res) => res.status(429).json({ error: 'Too many OTP requests. Please wait.' }),
});

module.exports = { globalRateLimiter, reportSubmitLimiter, otpLimiter };
