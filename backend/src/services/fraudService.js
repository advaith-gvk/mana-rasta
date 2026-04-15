/**
 * Fraud Prevention Service
 * Runs a suite of anti-abuse checks before a report is persisted.
 * Throws AppError on detected abuse; logs fraud events for review.
 */

const { query, withTransaction } = require('../config/db');
const { getRedis } = require('../config/redis');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

// Configurable thresholds (can be overridden via env)
const LIMITS = {
  IP_DAILY_MAX:      parseInt(process.env.FRAUD_IP_DAILY_MAX)       || 20,
  IP_HOURLY_MAX:     parseInt(process.env.FRAUD_IP_HOURLY_MAX)      || 8,
  DEVICE_DAILY_MAX:  parseInt(process.env.FRAUD_DEVICE_DAILY_MAX)   || 10,
  DEVICE_HOURLY_MAX: parseInt(process.env.FRAUD_DEVICE_HOURLY_MAX)  || 4,
  USER_DAILY_MAX:    parseInt(process.env.FRAUD_USER_DAILY_MAX)      || 15,
  USER_HOURLY_MAX:   parseInt(process.env.FRAUD_USER_HOURLY_MAX)    || 5,
  COOLDOWN_SECONDS:  parseInt(process.env.FRAUD_COOLDOWN_SECONDS)   || 120,
  IMPOSSIBLE_TRAVEL_SPEED_KMPH: 200,
  BURST_WINDOW_SECONDS: 60,
  BURST_MAX_IN_WINDOW:  3,
};

/**
 * Main entry: run all fraud checks. Throws on hard violation.
 */
async function runFraudChecks({ userId, deviceId, sourceIp, lat, lng }) {
  const redis = getRedis();
  const now   = Date.now();
  const violations = [];

  // 1. IP rate limits
  const ipHourKey  = `rl:ip:h:${sourceIp}:${getHourBucket()}`;
  const ipDayKey   = `rl:ip:d:${sourceIp}:${getDayBucket()}`;
  const ipHourCount = await incrWithTTL(redis, ipHourKey, 3600);
  const ipDayCount  = await incrWithTTL(redis, ipDayKey,  86400);

  if (ipHourCount > LIMITS.IP_HOURLY_MAX || ipDayCount > LIMITS.IP_DAILY_MAX) {
    violations.push('ip_limit');
  }

  // 2. Device rate limits
  if (deviceId) {
    const devHourKey = `rl:dev:h:${deviceId}:${getHourBucket()}`;
    const devDayKey  = `rl:dev:d:${deviceId}:${getDayBucket()}`;
    const devHour = await incrWithTTL(redis, devHourKey, 3600);
    const devDay  = await incrWithTTL(redis, devDayKey,  86400);
    if (devHour > LIMITS.DEVICE_HOURLY_MAX || devDay > LIMITS.DEVICE_DAILY_MAX) {
      violations.push('device_limit');
    }
  }

  // 3. User rate limits
  const userHourKey = `rl:user:h:${userId}:${getHourBucket()}`;
  const userDayKey  = `rl:user:d:${userId}:${getDayBucket()}`;
  const userHour = await incrWithTTL(redis, userHourKey, 3600);
  const userDay  = await incrWithTTL(redis, userDayKey,  86400);
  if (userHour > LIMITS.USER_HOURLY_MAX || userDay > LIMITS.USER_DAILY_MAX) {
    violations.push('user_limit');
  }

  // 4. Cooldown between submissions
  const cooldownKey = `rl:cd:${userId}`;
  const lastSub = await redis.get(cooldownKey);
  if (lastSub) {
    violations.push(null); // soft — don't count as fraud, just block
    throw new AppError(
      `Please wait before submitting another report (cooldown: ${LIMITS.COOLDOWN_SECONDS}s)`, 429
    );
  }
  await redis.setEx(cooldownKey, LIMITS.COOLDOWN_SECONDS, '1');

  // 5. Burst detection
  const burstKey = `rl:burst:${userId}`;
  const burstCount = await incrWithTTL(redis, burstKey, LIMITS.BURST_WINDOW_SECONDS);
  if (burstCount > LIMITS.BURST_MAX_IN_WINDOW) {
    violations.push('burst_submission');
  }

  // 6. Impossible travel check
  const lastLocKey = `geo:last:${userId}`;
  const lastLocRaw = await redis.get(lastLocKey);
  if (lastLocRaw) {
    const { lat: pLat, lng: pLng, ts: pTs } = JSON.parse(lastLocRaw);
    const distKm = haversineKm(pLat, pLng, lat, lng);
    const hrs    = (now - pTs) / 3_600_000;
    const speed  = hrs > 0 ? distKm / hrs : Infinity;
    if (speed > LIMITS.IMPOSSIBLE_TRAVEL_SPEED_KMPH && distKm > 5) {
      violations.push('impossible_travel');
    }
  }
  await redis.setEx(lastLocKey, 86400, JSON.stringify({ lat, lng, ts: now }));

  // 7. Check for existing user/device ban
  const { rows: banRows } = await query(
    `SELECT 1 FROM banned_users
     WHERE user_id = $1 AND (ban_type = 'permanent' OR expires_at > NOW())`,
    [userId]
  );
  if (banRows.length) throw new AppError('Account is suspended', 403);

  // ── Process violations ───────────────────────────────────
  if (violations.length > 0) {
    for (const reason of violations) {
      if (!reason) continue;
      await logFraudEvent({ userId, deviceId, sourceIp, reason,
        details: { lat, lng, violations } }).catch(logger.error);
    }

    // Auto-ban on severe or repeated violations
    const severeViolations = ['impossible_travel', 'burst_submission'];
    if (violations.some(v => severeViolations.includes(v))) {
      await incrementUserRisk(userId, 30);
    } else {
      await incrementUserRisk(userId, 10);
    }

    const { rows: riskRows } = await query('SELECT risk_score FROM users WHERE id = $1', [userId]);
    if (riskRows[0]?.risk_score >= 80) {
      await autoTempBan(userId, 'Automated ban: fraud score threshold reached');
    }

    if (violations.some(v => ['ip_limit', 'device_limit', 'user_limit', 'burst_submission'].includes(v))) {
      throw new AppError('Submission limit reached. Please try again later.', 429);
    }
    if (violations.includes('impossible_travel')) {
      throw new AppError('Location validation failed.', 422);
    }
  }
}

/**
 * Check an image phash against recent submissions for duplicate images.
 */
async function checkDuplicateImage(phash, userId) {
  if (!phash) return false;
  const { rows } = await query(
    `SELECT 1 FROM report_images ri
     JOIN reports r ON r.id = ri.report_id
     WHERE ri.phash = $1
       AND r.user_id = $2
       AND r.created_at > NOW() - INTERVAL '7 days'
     LIMIT 1`,
    [phash, userId]
  );
  return rows.length > 0;
}

async function logFraudEvent({ userId, deviceId, sourceIp, reason, details, reportId }) {
  await query(
    `INSERT INTO fraud_events(user_id, device_id, report_id, source_ip, reason, details)
     VALUES($1, $2, $3, $4::inet, $5, $6::jsonb)`,
    [userId, deviceId, reportId || null, sourceIp, reason, JSON.stringify(details)]
  );
}

async function incrementUserRisk(userId, delta) {
  await query(
    'UPDATE users SET risk_score = LEAST(100, risk_score + $1) WHERE id = $2',
    [delta, userId]
  );
}

async function autoTempBan(userId, reason) {
  await query(
    `INSERT INTO banned_users(user_id, ban_type, reason, expires_at)
     VALUES($1, 'temporary', $2, NOW() + INTERVAL '7 days')
     ON CONFLICT(user_id) DO UPDATE SET
       ban_type = 'temporary', reason = EXCLUDED.reason,
       banned_at = NOW(), expires_at = EXCLUDED.expires_at`,
    [userId, reason]
  );
  await query('UPDATE users SET is_active = FALSE WHERE id = $1', [userId]);
  logger.warn(`Auto-banned user ${userId}: ${reason}`);
}

// ── Helpers ────────────────────────────────────────────────

async function incrWithTTL(redis, key, ttl) {
  const val = await redis.incr(key);
  if (val === 1) await redis.expire(key, ttl);
  return val;
}

function getHourBucket() {
  const d = new Date();
  return `${d.getUTCFullYear()}${d.getUTCMonth()}${d.getUTCDate()}${d.getUTCHours()}`;
}

function getDayBucket() {
  const d = new Date();
  return `${d.getUTCFullYear()}${d.getUTCMonth()}${d.getUTCDate()}`;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) { return deg * Math.PI / 180; }

module.exports = {
  runFraudChecks, checkDuplicateImage, logFraudEvent, autoTempBan,
};
