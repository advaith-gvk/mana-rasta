const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query, withTransaction } = require('../config/db');
const { cacheSet, cacheGet, cacheDel } = require('../config/redis');
const logger = require('../utils/logger');
const { sendOTP } = require('../services/smsService');
const { AppError } = require('../utils/errors');

const JWT_SECRET   = process.env.JWT_SECRET;
const JWT_EXPIRES  = process.env.JWT_EXPIRES_IN || '7d';
const OTP_TTL_SEC  = 300; // 5 minutes

function signToken(userId, role) {
  return jwt.sign({ sub: userId, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

/**
 * POST /auth/send-otp
 */
async function sendOtp(req, res) {
  const { phone } = req.body;

  // Check if user is banned
  const banCheck = await query(
    `SELECT 1 FROM banned_users bu
     JOIN users u ON u.id = bu.user_id
     WHERE u.phone = $1 AND (bu.ban_type = 'permanent' OR bu.expires_at > NOW())`,
    [phone]
  );
  if (banCheck.rows.length) throw new AppError('Account suspended', 403);

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await bcrypt.hash(otp, 8);

  await query(
    `INSERT INTO otp_verifications(phone, otp_hash, expires_at)
     VALUES($1, $2, NOW() + INTERVAL '5 minutes')`,
    [phone, otpHash]
  );

  await sendOTP(phone, otp);
  logger.info(`OTP sent to ${phone}`);

  res.json({ message: 'OTP sent', expiresIn: OTP_TTL_SEC });
}

/**
 * POST /auth/verify-otp
 */
async function verifyOtp(req, res) {
  const { phone, otp, deviceFingerprint, deviceModel, platform, appVersion } = req.body;

  const { rows } = await query(
    `SELECT id, otp_hash, attempts, expires_at FROM otp_verifications
     WHERE phone = $1 AND verified = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [phone]
  );

  if (!rows.length) throw new AppError('OTP expired or not found', 400);

  const record = rows[0];
  if (record.attempts >= 5) throw new AppError('Too many OTP attempts', 429);

  const valid = await bcrypt.compare(otp, record.otp_hash);
  if (!valid) {
    await query('UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = $1', [record.id]);
    throw new AppError('Invalid OTP', 400);
  }

  await query('UPDATE otp_verifications SET verified = TRUE WHERE id = $1', [record.id]);

  // Upsert user
  let user = await withTransaction(async (client) => {
    let { rows: existing } = await client.query(
      'SELECT id, role FROM users WHERE phone = $1', [phone]
    );

    if (!existing.length) {
      const newId = uuidv4();
      await client.query(
        `INSERT INTO users(id, phone, role, is_active, is_verified)
         VALUES($1, $2, 'citizen', TRUE, TRUE)`,
        [newId, phone]
      );
      await client.query(
        'INSERT INTO user_profiles(user_id) VALUES($1)', [newId]
      );
      await client.query(
        'INSERT INTO reward_wallets(user_id) VALUES($1)', [newId]
      );
      existing = [{ id: newId, role: 'citizen' }];
    }

    // Upsert device
    if (deviceFingerprint) {
      // Check device ban
      const { rows: deviceBan } = await client.query(
        `SELECT 1 FROM banned_devices WHERE fingerprint = $1
         AND (ban_type = 'permanent' OR expires_at > NOW())`,
        [deviceFingerprint]
      );
      if (deviceBan.length) throw new AppError('Device is banned', 403);

      await client.query(
        `INSERT INTO user_devices(user_id, fingerprint, platform, device_model, app_version)
         VALUES($1, $2, $3, $4, $5)
         ON CONFLICT(fingerprint) DO UPDATE SET
           last_seen_at = NOW(), app_version = EXCLUDED.app_version`,
        [existing[0].id, deviceFingerprint, platform, deviceModel, appVersion]
      );
    }

    return existing[0];
  });

  await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

  const token = signToken(user.id, user.role);
  res.json({ token, userId: user.id, role: user.role });
}

/**
 * POST /auth/refresh
 */
async function refreshToken(req, res) {
  const { token } = req.body;
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
  } catch {
    throw new AppError('Invalid token', 401);
  }

  const { rows } = await query(
    'SELECT id, role, is_active FROM users WHERE id = $1', [decoded.sub]
  );
  if (!rows.length || !rows[0].is_active) throw new AppError('User not found', 401);

  const newToken = signToken(rows[0].id, rows[0].role);
  res.json({ token: newToken });
}

/**
 * GET /auth/me
 */
async function getMe(req, res) {
  const { rows } = await query(
    `SELECT u.id, u.phone, u.email, u.name, u.role,
            up.avatar_url, up.streak_days, up.total_reports, up.verified_reports,
            rw.balance                                             AS points_balance,
            z.name                                                 AS zone_name,
            (SELECT COUNT(*) FROM reports r2
              WHERE r2.user_id = u.id
                AND r2.status  = 'fixed'
                AND r2.updated_at >= date_trunc('month', NOW()))::int AS fixed_reports,
            (SELECT COUNT(*) FROM reports r3
              WHERE r3.user_id = u.id
                AND r3.status NOT IN ('fixed','rejected','fraudulent'))::int
                                                                   AS open_reports,
            (SELECT COUNT(*) FROM reports r4
              JOIN wards w4 ON w4.id = r4.ward_id
              WHERE r4.status NOT IN ('fixed','rejected','fraudulent')
                AND w4.circle_id = (
                  SELECT w.circle_id FROM reports rx
                  JOIN wards w ON w.id = rx.ward_id
                  WHERE rx.user_id = u.id ORDER BY rx.created_at DESC LIMIT 1
                ))::int                                            AS open_nearby
     FROM users u
     LEFT JOIN user_profiles up ON up.user_id = u.id
     LEFT JOIN reward_wallets rw ON rw.user_id = u.id
     LEFT JOIN LATERAL (
       SELECT w.circle_id, ci.zone_id
       FROM reports rx
       JOIN wards   w  ON w.id  = rx.ward_id
       JOIN circles ci ON ci.id = w.circle_id
       WHERE rx.user_id = u.id
       ORDER BY rx.created_at DESC LIMIT 1
     ) loc ON true
     LEFT JOIN zones z ON z.id = loc.zone_id
     WHERE u.id = $1`,
    [req.user.id]
  );
  if (!rows.length) throw new AppError('Not found', 404);
  res.json(rows[0]);
}

/**
 * PATCH /auth/profile
 */
async function updateProfile(req, res) {
  const { name, email, fcmToken } = req.body;
  await query('UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email) WHERE id = $3',
    [name, email, req.user.id]);
  if (fcmToken) {
    await query('UPDATE user_profiles SET fcm_token = $1 WHERE user_id = $2', [fcmToken, req.user.id]);
  }
  res.json({ message: 'Profile updated' });
}

module.exports = { sendOtp, verifyOtp, refreshToken, getMe, updateProfile };
