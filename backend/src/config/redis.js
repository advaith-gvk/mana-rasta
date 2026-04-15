const { createClient } = require('redis');
const logger = require('../utils/logger');

let redisClient;

async function connectRedis() {
  redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: { reconnectStrategy: (retries) => Math.min(retries * 100, 3000) },
  });

  redisClient.on('error', (err) => logger.error('Redis error', err));
  redisClient.on('reconnecting', () => logger.info('Redis reconnecting...'));

  await redisClient.connect();
  logger.info('Redis connected');
}

function getRedis() {
  if (!redisClient) throw new Error('Redis not initialized');
  return redisClient;
}

// Convenience helpers
async function cacheGet(key) {
  const val = await getRedis().get(key);
  return val ? JSON.parse(val) : null;
}

async function cacheSet(key, value, ttlSeconds = 300) {
  await getRedis().setEx(key, ttlSeconds, JSON.stringify(value));
}

async function cacheDel(key) {
  await getRedis().del(key);
}

async function cacheIncr(key) {
  return getRedis().incr(key);
}

async function cacheExpire(key, ttlSeconds) {
  return getRedis().expire(key, ttlSeconds);
}

module.exports = { connectRedis, getRedis, cacheGet, cacheSet, cacheDel, cacheIncr, cacheExpire };
