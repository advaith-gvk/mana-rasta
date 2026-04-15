const express = require('express');
const router  = express.Router();
const Joi     = require('joi');
const { authenticate } = require('../middleware/auth');
const { validate, validateQuery } = require('../middleware/validate');
const { query } = require('../config/db');
const { redeemReward, refreshLeaderboards } = require('../services/rewardsService');
const { AppError } = require('../utils/errors');

router.use(authenticate);

// GET /rewards/wallet
router.get('/wallet', async (req, res) => {
  const { rows } = await query(
    `SELECT rw.balance, rw.total_earned, rw.total_spent,
            json_agg(json_build_object(
              'event', re.event_type, 'points', re.points,
              'desc', re.description, 'at', re.created_at
            ) ORDER BY re.created_at DESC) AS recent_events
     FROM reward_wallets rw
     LEFT JOIN reward_events re ON re.user_id = rw.user_id
       AND re.created_at > NOW() - INTERVAL '30 days'
     WHERE rw.user_id = $1
     GROUP BY rw.balance, rw.total_earned, rw.total_spent`,
    [req.user.id]
  );
  res.json(rows[0] || { balance: 0, total_earned: 0, total_spent: 0, recent_events: [] });
});

// GET /rewards/badges
router.get('/badges', async (req, res) => {
  const { rows } = await query(
    `SELECT a.code, a.name, a.description, a.icon_url, a.points,
            ua.earned_at,
            CASE WHEN ua.user_id IS NOT NULL THEN TRUE ELSE FALSE END AS earned
     FROM achievements a
     LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.user_id = $1
     ORDER BY earned DESC, a.points DESC`,
    [req.user.id]
  );
  res.json(rows);
});

// GET /rewards/leaderboard
router.get('/leaderboard',
  validateQuery(Joi.object({
    period: Joi.string().valid('weekly','monthly','alltime').default('weekly'),
    zoneId: Joi.string().uuid(),
    limit:  Joi.number().integer().min(1).max(100).default(50),
  })),
  async (req, res) => {
    const { period = 'weekly', limit = 50 } = req.query;
    const periodKey = period === 'alltime' ? 'all' : getCurrentPeriodKey(period);

    const { rows } = await query(
      `SELECT ls.rank, ls.score, u.name, u.id AS user_id,
              up.avatar_url, up.streak_days
       FROM leaderboard_snapshots ls
       JOIN users u ON u.id = ls.user_id
       LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE ls.period_type = $1 AND ls.period_key = $2
       ORDER BY ls.rank ASC
       LIMIT $3`,
      [period, periodKey, parseInt(limit)]
    );

    // Also fetch current user's rank
    const { rows: myRank } = await query(
      `SELECT rank, score FROM leaderboard_snapshots
       WHERE period_type = $1 AND period_key = $2 AND user_id = $3`,
      [period, periodKey, req.user.id]
    );

    res.json({ leaderboard: rows, myRank: myRank[0] || null });
  }
);

// GET /rewards/catalog
router.get('/catalog', async (req, res) => {
  const { rows } = await query(
    `SELECT id, title, description, partner_name, points_cost, stock, image_url
     FROM reward_catalog
     WHERE is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY points_cost ASC`
  );
  res.json(rows);
});

// POST /rewards/redeem
router.post('/redeem',
  validate(Joi.object({ catalogId: Joi.string().uuid().required() })),
  async (req, res) => {
    await redeemReward(req.user.id, req.body.catalogId);
    res.json({ message: 'Reward redeemed successfully' });
  }
);

// GET /rewards/redemptions
router.get('/redemptions', async (req, res) => {
  const { rows } = await query(
    `SELECT rr.*, rc.title, rc.partner_name
     FROM reward_redemptions rr
     JOIN reward_catalog rc ON rc.id = rr.catalog_id
     WHERE rr.user_id = $1
     ORDER BY rr.created_at DESC`,
    [req.user.id]
  );
  res.json(rows);
});

function getCurrentPeriodKey(period) {
  const d = new Date();
  if (period === 'monthly') {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  const start = new Date(d.getFullYear(), 0, 1);
  const week  = Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2,'0')}`;
}

module.exports = router;
