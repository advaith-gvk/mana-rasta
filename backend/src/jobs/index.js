const cron   = require('node-cron');
const logger = require('../utils/logger');
const { query } = require('../config/db');
const { refreshLeaderboards } = require('../services/rewardsService');
const { sendPushNotification } = require('../config/firebase');

function startAllJobs() {
  // ── Every hour: recompute priority scores for open reports
  cron.schedule('0 * * * *', async () => {
    try {
      const { rowCount } = await query(
        `UPDATE reports
         SET priority_score = compute_priority_score(id)
         WHERE status NOT IN ('fixed','rejected','fraudulent')`
      );
      logger.info(`Priority scores refreshed for ${rowCount} reports`);
    } catch (err) {
      logger.error('Priority refresh job error', err);
    }
  });

  // ── Every 6 hours: refresh leaderboards
  cron.schedule('0 */6 * * *', async () => {
    try {
      await refreshLeaderboards();
    } catch (err) {
      logger.error('Leaderboard job error', err);
    }
  });

  // ── Every 2 hours: refresh officer performance + SLA heatmap mat views
  cron.schedule('0 */2 * * *', async () => {
    try {
      await query('SELECT refresh_performance_views()');
      logger.info('Officer performance & SLA heatmap views refreshed');
    } catch (err) {
      logger.error('Performance view refresh error', err);
    }
  });

  // ── Every hour: SLA escalation — push-notify supervisors about overdue reports
  cron.schedule('30 * * * *', async () => {
    try {
      const { rows } = await query(
        `SELECT r.id, r.severity, w.name AS ward_name,
                ae_off.name AS ae_name, ae_off.designation AS ae_designation,
                u.id AS admin_id, up.fcm_token
         FROM reports r
         LEFT JOIN ghmc_wards    w      ON w.id = r.ward_id
         LEFT JOIN ghmc_officers ae_off ON ae_off.id = r.ae_officer_id
         JOIN users u ON u.role IN ('admin','supervisor')
         JOIN user_profiles up ON up.user_id = u.id AND up.fcm_token IS NOT NULL
         WHERE r.sla_deadline < NOW()
           AND r.status NOT IN ('fixed','rejected','fraudulent')
           AND r.created_at > NOW() - INTERVAL '7 days'
         LIMIT 50`
      );

      for (const row of rows) {
        const officerTag = row.ae_name
          ? ` — ${row.ae_designation || 'AE'} ${row.ae_name}`
          : '';
        await sendPushNotification({
          token: row.fcm_token,
          title: `⚠️ SLA Breached: ${row.severity} pothole`,
          body:  `${row.ward_name}${officerTag} · Report ${row.id.substring(0, 8)} is overdue`,
          data:  { type: 'sla_breach', reportId: row.id },
        }).catch(() => {});
      }
      if (rows.length) logger.info(`SLA alerts sent for ${rows.length} overdue reports`);
    } catch (err) {
      logger.error('SLA escalation job error', err);
    }
  });

  // ── Daily at 2am: expire temporary bans
  cron.schedule('0 2 * * *', async () => {
    try {
      const { rowCount: userBans } = await query(
        `UPDATE users SET is_active = TRUE
         WHERE id IN (
           SELECT user_id FROM banned_users
           WHERE ban_type = 'temporary' AND expires_at < NOW()
         )`
      );
      await query(
        `DELETE FROM banned_users WHERE ban_type = 'temporary' AND expires_at < NOW()`
      );
      const { rowCount: deviceBans } = await query(
        `DELETE FROM banned_devices WHERE ban_type = 'temporary' AND expires_at < NOW()`
      );
      logger.info(`Expired ${userBans} user bans, ${deviceBans} device bans`);
    } catch (err) {
      logger.error('Ban expiry job error', err);
    }
  });

  // ── Daily at 3am: clean expired OTPs
  cron.schedule('0 3 * * *', async () => {
    try {
      const { rowCount } = await query(
        `DELETE FROM otp_verifications WHERE expires_at < NOW() - INTERVAL '1 day'`
      );
      logger.info(`Cleaned ${rowCount} expired OTP records`);
    } catch (err) {
      logger.error('OTP cleanup job error', err);
    }
  });

  // ── Daily at 4am: mark stale unaddressed reports for supervisor review
  cron.schedule('0 4 * * *', async () => {
    try {
      const { rows } = await query(
        `SELECT r.id, r.severity, z.name AS zone
         FROM reports r
         LEFT JOIN ghmc_zones z ON z.id = r.zone_id
         WHERE r.status = 'submitted'
           AND r.created_at < NOW() - INTERVAL '72 hours'
           AND r.severity IN ('high','critical')
         LIMIT 100`
      );
      for (const r of rows) {
        await query(
          `INSERT INTO report_status_history(report_id, to_status, note)
           VALUES($1, 'under_review', 'Auto-escalated: stale high-severity report')
           ON CONFLICT DO NOTHING`,
          [r.id]
        );
        await query(
          `UPDATE reports SET status = 'under_review' WHERE id = $1 AND status = 'submitted'`,
          [r.id]
        );
      }
      if (rows.length) logger.info(`Auto-escalated ${rows.length} stale reports`);
    } catch (err) {
      logger.error('Stale report escalation job error', err);
    }
  });

  logger.info('Background jobs started');
}

module.exports = { startAllJobs };
