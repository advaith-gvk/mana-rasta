/**
 * Rewards Engine
 * Handles point credits, badge checks, streak updates, leaderboard refresh.
 * All reward grants are idempotent and abuse-resistant.
 */

const { query, withTransaction } = require('../config/db');
const { cacheGet, cacheSet } = require('../config/redis');
const { sendPushNotification } = require('../config/firebase');
const logger = require('../utils/logger');

// Points configuration
const POINT_VALUES = {
  report_submitted:     20,
  report_verified:      30,   // bonus when admin verifies
  report_fixed:         50,   // bonus when fixed
  acknowledgment_given: 5,
  first_ward_report:    100,  // first ever report in a ward
  community_verified:   25,   // 5+ acknowledgments
  streak_bonus:         10,   // per streak day (capped)
  redemption:           0,
};

/**
 * Credit points to a user for an event.
 * Skips if report is fraudulent.
 */
async function creditPoints(userId, eventType, reportId, options = {}) {
  // Safety: never credit for fraudulent reports
  if (reportId) {
    const { rows } = await query(
      'SELECT status FROM reports WHERE id = $1', [reportId]
    );
    if (rows[0]?.status === 'fraudulent') {
      logger.info(`Reward skipped: report ${reportId} is fraudulent`);
      return;
    }
  }

  const basePoints = POINT_VALUES[eventType] || 0;
  let totalPoints  = basePoints;
  const breakdown  = [{ event: eventType, points: basePoints }];

  // First ward report bonus
  if (options.isFirstInWard && options.wardId && eventType === 'report_submitted') {
    totalPoints += POINT_VALUES.first_ward_report;
    breakdown.push({ event: 'first_ward_report', points: POINT_VALUES.first_ward_report });
  }

  if (totalPoints <= 0) return;

  await withTransaction(async (client) => {
    // Insert reward event
    await client.query(
      `INSERT INTO reward_events(user_id, event_type, points, report_id, description)
       VALUES($1, $2, $3, $4, $5)`,
      [userId, eventType, totalPoints, reportId,
       breakdown.map(b => `${b.event}:+${b.points}`).join(', ')]
    );

    // Update wallet
    await client.query(
      `INSERT INTO reward_wallets(user_id, balance, total_earned)
       VALUES($1, $2, $2)
       ON CONFLICT(user_id) DO UPDATE SET
         balance = reward_wallets.balance + $2,
         total_earned = reward_wallets.total_earned + $2,
         updated_at = NOW()`,
      [userId, totalPoints]
    );
  });

  // Check and award badges
  await checkAndAwardBadges(userId, reportId, eventType).catch(logger.error);

  // Update streak
  await updateStreak(userId).catch(logger.error);

  logger.info(`Credited ${totalPoints} points to user ${userId} for ${eventType}`);
}

/**
 * Check badge criteria and award any newly earned achievements.
 */
async function checkAndAwardBadges(userId, reportId, triggerEvent) {
  const { rows: profile } = await query(
    `SELECT up.total_reports, up.verified_reports, up.streak_days, up.last_report_date,
            rw.total_earned
     FROM user_profiles up
     JOIN reward_wallets rw ON rw.user_id = up.user_id
     WHERE up.user_id = $1`,
    [userId]
  );
  if (!profile.length) return;
  const p = profile[0];

  const { rows: already } = await query(
    'SELECT achievement_id FROM user_achievements WHERE user_id = $1', [userId]
  );
  const earned = new Set(already.map(r => r.achievement_id));

  const { rows: allBadges } = await query('SELECT * FROM achievements');

  for (const badge of allBadges) {
    if (earned.has(badge.id)) continue;
    const criteria = badge.criteria || {};
    let qualifies  = false;

    switch (badge.code) {
      case 'FIRST_REPORT':
        qualifies = p.total_reports >= 1;
        break;
      case 'COMMUNITY_GUARD':
        // 10 acknowledgments given
        const { rows: ackR } = await query(
          'SELECT COUNT(*) c FROM acknowledgments WHERE user_id = $1', [userId]
        );
        qualifies = parseInt(ackR[0].c) >= 10;
        break;
      case 'STREAK_7':
        qualifies = p.streak_days >= 7;
        break;
      case 'STREAK_30':
        qualifies = p.streak_days >= 30;
        break;
      case 'CENTURY':
        qualifies = p.verified_reports >= 100;
        break;
      case 'FAST_FIX':
        const { rows: ffR } = await query(
          `SELECT COUNT(*) c FROM reports
           WHERE user_id = $1 AND status = 'fixed'
             AND fixed_at < created_at + INTERVAL '48 hours'`,
          [userId]
        );
        qualifies = parseInt(ffR[0].c) >= 3;
        break;
      case 'WARD_CHAMPION':
        // Triggered by first_ward_report event
        qualifies = triggerEvent === 'report_submitted' && Boolean(reportId);
        break;
    }

    if (qualifies) {
      await withTransaction(async (client) => {
        await client.query(
          `INSERT INTO user_achievements(user_id, achievement_id) VALUES($1, $2)
           ON CONFLICT DO NOTHING`,
          [userId, badge.id]
        );
        if (badge.points > 0) {
          await client.query(
            `UPDATE reward_wallets SET balance = balance + $1, total_earned = total_earned + $1
             WHERE user_id = $2`,
            [badge.points, userId]
          );
          await client.query(
            `INSERT INTO reward_events(user_id, event_type, points, description)
             VALUES($1, 'streak_bonus', $2, $3)`,
            [userId, badge.points, `Badge: ${badge.name}`]
          );
        }
      });

      // Push notification
      const { rows: tokenRows } = await query(
        'SELECT fcm_token FROM user_profiles WHERE user_id = $1 AND fcm_token IS NOT NULL', [userId]
      );
      if (tokenRows[0]?.fcm_token) {
        await sendPushNotification({
          token: tokenRows[0].fcm_token,
          title: `🏆 Badge Unlocked: ${badge.name}`,
          body:  badge.description,
          data:  { type: 'badge_unlocked', badgeCode: badge.code },
        });
      }

      logger.info(`Badge ${badge.code} awarded to user ${userId}`);
    }
  }
}

/**
 * Update streak for the user based on last_report_date.
 */
async function updateStreak(userId) {
  const { rows } = await query(
    'SELECT last_report_date, streak_days FROM user_profiles WHERE user_id = $1', [userId]
  );
  if (!rows.length) return;

  const { last_report_date, streak_days } = rows[0];
  const today     = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const lastDate  = last_report_date?.toISOString?.().split('T')[0] || last_report_date;

  let newStreak = streak_days;
  if (lastDate === yesterday) {
    newStreak = streak_days + 1;
  } else if (lastDate !== today) {
    newStreak = 1; // reset
  }

  await query(
    'UPDATE user_profiles SET streak_days = $1, last_report_date = $2 WHERE user_id = $3',
    [newStreak, today, userId]
  );
}

/**
 * Redeem a reward from the catalog.
 */
async function redeemReward(userId, catalogId) {
  const { rows: catRows } = await query(
    `SELECT * FROM reward_catalog WHERE id = $1 AND is_active = TRUE
     AND (expires_at IS NULL OR expires_at > NOW())`,
    [catalogId]
  );
  if (!catRows.length) throw new Error('Reward not available');
  const catalog = catRows[0];

  await withTransaction(async (client) => {
    // Lock and check balance
    const { rows: walletRows } = await client.query(
      'SELECT balance FROM reward_wallets WHERE user_id = $1 FOR UPDATE', [userId]
    );
    const balance = walletRows[0]?.balance || 0;
    if (balance < catalog.points_cost) throw new Error('Insufficient points');

    // Deduct points
    await client.query(
      `UPDATE reward_wallets SET balance = balance - $1, total_spent = total_spent + $1 WHERE user_id = $2`,
      [catalog.points_cost, userId]
    );

    // Decrement stock if finite
    if (catalog.stock !== null) {
      const { rowCount } = await client.query(
        'UPDATE reward_catalog SET stock = stock - 1 WHERE id = $1 AND stock > 0', [catalogId]
      );
      if (!rowCount) throw new Error('Out of stock');
    }

    // Create redemption
    const coupon = generateCoupon();
    await client.query(
      `INSERT INTO reward_redemptions(user_id, catalog_id, points_spent, coupon_code, status)
       VALUES($1, $2, $3, $4, 'fulfilled')`,
      [userId, catalogId, catalog.points_cost, coupon]
    );

    await client.query(
      `INSERT INTO reward_events(user_id, event_type, points, description)
       VALUES($1, 'redemption', $2, $3)`,
      [userId, -catalog.points_cost, `Redeemed: ${catalog.title}`]
    );
  });
}

/**
 * Refresh weekly and monthly leaderboards. Called by cron job.
 */
async function refreshLeaderboards() {
  const periods = [
    { type: 'weekly',  key: getWeekKey() },
    { type: 'monthly', key: getMonthKey() },
    { type: 'alltime', key: 'all' },
  ];

  for (const period of periods) {
    const { rows } = await query(
      `SELECT re.user_id, SUM(re.points) AS score
       FROM reward_events re
       WHERE re.points > 0
       ${period.type === 'weekly'  ? "AND re.created_at > NOW() - INTERVAL '7 days'"  : ''}
       ${period.type === 'monthly' ? "AND re.created_at > NOW() - INTERVAL '30 days'" : ''}
       GROUP BY re.user_id
       ORDER BY score DESC
       LIMIT 500`
    );

    for (let i = 0; i < rows.length; i++) {
      await query(
        `INSERT INTO leaderboard_snapshots(period_type, period_key, user_id, rank, score)
         VALUES($1, $2, $3, $4, $5)
         ON CONFLICT(period_type, period_key, user_id) DO UPDATE SET
           rank = EXCLUDED.rank, score = EXCLUDED.score, computed_at = NOW()`,
        [period.type, period.key, rows[i].user_id, i + 1, rows[i].score]
      );
    }
  }
  logger.info('Leaderboards refreshed');
}

function generateCoupon() {
  return 'HYD-' + Math.random().toString(36).substring(2, 10).toUpperCase();
}

function getWeekKey() {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 1);
  const week  = Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

module.exports = { creditPoints, redeemReward, refreshLeaderboards, updateStreak };
