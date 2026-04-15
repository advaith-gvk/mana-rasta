const { query, withTransaction } = require('../config/db');
const { sendPushNotification } = require('../config/firebase');
const { cacheGet, cacheSet, cacheDel } = require('../config/redis');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * GET /admin/reports  — priority queue for dashboard
 */
async function getDashboardQueue(req, res) {
  const {
    zone_id, circle_id, ward_id, severity, status,
    min_age_hours, min_validations,
    page = 1, limit = 50,
    sort = 'priority',
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const conditions = ["r.status NOT IN ('rejected','fraudulent')"];
  const params     = [];

  if (zone_id)           { params.push(zone_id);           conditions.push(`r.zone_id = $${params.length}`); }
  if (circle_id)         { params.push(circle_id);         conditions.push(`r.circle_id = $${params.length}`); }
  if (ward_id)           { params.push(ward_id);           conditions.push(`r.ward_id = $${params.length}`); }
  if (severity)          { params.push(severity);          conditions.push(`r.severity = $${params.length}`); }
  if (status)            { params.push(status);            conditions.push(`r.status = $${params.length}`); }
  if (min_age_hours)     { params.push(parseInt(min_age_hours)); conditions.push(`r.created_at < NOW() - ($${params.length} || ' hours')::interval`); }
  if (min_validations)   { params.push(parseInt(min_validations)); conditions.push(`r.acknowledgment_count >= $${params.length}`); }

  const orderBy = sort === 'priority'  ? 'r.priority_score DESC' :
                  sort === 'oldest'    ? 'r.created_at ASC'      :
                  sort === 'severity'  ? "CASE r.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END" :
                  'r.created_at DESC';

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(parseInt(limit), offset);

  const { rows } = await query(
    `SELECT r.id, r.severity, r.status, r.priority_score,
            r.latitude, r.longitude, r.address_text,
            r.acknowledgment_count, r.created_at, r.sla_deadline,
            r.assigned_to, r.road_type,
            w.name AS ward_name, w.ward_number,
            c.name AS circle_name,
            z.name AS zone_name,
            u.name AS reporter_name, u.risk_score AS user_risk,
            ri.thumbnail_url,
            CASE WHEN r.sla_deadline < NOW() THEN TRUE ELSE FALSE END AS sla_breached
     FROM reports r
     LEFT JOIN ghmc_wards w   ON w.id = r.ward_id
     LEFT JOIN ghmc_circles c ON c.id = r.circle_id
     LEFT JOIN ghmc_zones z   ON z.id = r.zone_id
     LEFT JOIN users u        ON u.id = r.user_id
     LEFT JOIN LATERAL (
       SELECT thumbnail_url FROM report_images WHERE report_id = r.id LIMIT 1
     ) ri ON TRUE
     ${where}
     ORDER BY ${orderBy}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  // Total count for pagination
  const { rows: countRows } = await query(
    `SELECT COUNT(*) AS total FROM reports r ${where}`,
    params.slice(0, -2)
  );

  res.json({
    data:  rows,
    total: parseInt(countRows[0].total),
    page:  parseInt(page),
    limit: parseInt(limit),
  });
}

/**
 * PATCH /admin/reports/:id/status  — change status + notify citizen
 */
async function updateReportStatus(req, res) {
  const { id } = req.params;
  const { status, note, assignTo } = req.body;
  const adminId = req.user.id;

  const validStatuses = ['under_review','verified','assigned','in_progress','fixed','rejected','fraudulent'];
  if (!validStatuses.includes(status)) throw new AppError('Invalid status', 400);

  await withTransaction(async (client) => {
    const { rows } = await client.query(
      'SELECT status, user_id FROM reports WHERE id = $1 FOR UPDATE', [id]
    );
    if (!rows.length) throw new AppError('Report not found', 404);
    const { status: oldStatus, user_id } = rows[0];

    const updates = ['status = $1', 'updated_at = NOW()'];
    const vals    = [status];

    if (assignTo) {
      updates.push(`assigned_to = $${vals.push(assignTo)}`);
      updates.push(`assigned_at = NOW()`);
    }
    if (status === 'fixed') {
      updates.push('fixed_at = NOW()');
    }

    vals.push(id);
    await client.query(
      `UPDATE reports SET ${updates.join(', ')} WHERE id = $${vals.length}`, vals
    );

    // History
    await client.query(
      `INSERT INTO report_status_history(report_id, from_status, to_status, changed_by, note)
       VALUES($1, $2, $3, $4, $5)`,
      [id, oldStatus, status, adminId, note]
    );

    // Admin audit log
    await client.query(
      `INSERT INTO admin_actions(admin_id, action, target_type, target_id, payload, ip_address)
       VALUES($1, 'update_status', 'report', $2, $3::jsonb, $4::inet)`,
      [adminId, id, JSON.stringify({ from: oldStatus, to: status, note }), req.ip]
    );

    // Push notification to citizen
    const { rows: tokenRows } = await client.query(
      `SELECT up.fcm_token FROM user_profiles up WHERE up.user_id = $1 AND fcm_token IS NOT NULL`,
      [user_id]
    );
    if (tokenRows[0]?.fcm_token) {
      const statusMessages = {
        verified:    'Your report has been verified ✓',
        in_progress: 'Work has started on your reported pothole 🚧',
        fixed:       'The pothole you reported has been fixed! 🎉',
        rejected:    'Your report has been reviewed and closed.',
      };
      const body = statusMessages[status] || `Report status updated to: ${status}`;
      await sendPushNotification({
        token: tokenRows[0].fcm_token,
        title: 'Mana Rasta — Report Update',
        body,
        data:  { type: 'status_update', reportId: id, status },
      });
    }
  });

  // Extra: credit points if fixed
  if (status === 'fixed') {
    const { rows: rRows } = await query('SELECT user_id FROM reports WHERE id = $1', [id]);
    if (rRows[0]) {
      const { creditPoints } = require('../services/rewardsService');
      creditPoints(rRows[0].user_id, 'report_fixed', id).catch(logger.error);
    }
  }

  res.json({ message: 'Status updated' });
}

/**
 * POST /admin/users/:id/ban
 */
async function banUser(req, res) {
  const { id } = req.params;
  const { banType = 'temporary', reason, durationDays = 7 } = req.body;

  await withTransaction(async (client) => {
    const expiresAt = banType === 'temporary'
      ? `NOW() + INTERVAL '${parseInt(durationDays)} days'`
      : 'NULL';

    await client.query(
      `INSERT INTO banned_users(user_id, ban_type, reason, banned_by, expires_at)
       VALUES($1, $2, $3, $4, ${banType === 'temporary' ? `NOW() + INTERVAL '${parseInt(durationDays)} days'` : 'NULL'})
       ON CONFLICT(user_id) DO UPDATE SET
         ban_type = EXCLUDED.ban_type, reason = EXCLUDED.reason,
         banned_at = NOW(), expires_at = EXCLUDED.expires_at`,
      [id, banType, reason, req.user.id]
    );
    await client.query('UPDATE users SET is_active = FALSE WHERE id = $1', [id]);
    await client.query(
      `INSERT INTO admin_actions(admin_id, action, target_type, target_id, payload, ip_address)
       VALUES($1, 'ban_user', 'user', $2, $3::jsonb, $4::inet)`,
      [req.user.id, id, JSON.stringify({ banType, reason, durationDays }), req.ip]
    );
  });

  res.json({ message: `User ${banType === 'permanent' ? 'permanently' : 'temporarily'} banned` });
}

/**
 * POST /admin/devices/:fingerprint/ban
 */
async function banDevice(req, res) {
  const { fingerprint } = req.params;
  const { banType = 'temporary', reason, durationDays = 7 } = req.body;

  await query(
    `INSERT INTO banned_devices(fingerprint, ban_type, reason, banned_by, expires_at)
     VALUES($1, $2, $3, $4, ${banType === 'temporary' ? `NOW() + INTERVAL '${parseInt(durationDays)} days'` : 'NULL'})
     ON CONFLICT(fingerprint) DO UPDATE SET ban_type = EXCLUDED.ban_type,
       reason = EXCLUDED.reason, banned_at = NOW(), expires_at = EXCLUDED.expires_at`,
    [fingerprint, banType, reason, req.user.id]
  );
  res.json({ message: 'Device banned' });
}

/**
 * GET /admin/fraud  — fraud dashboard
 */
async function getFraudDashboard(req, res) {
  const { page = 1, limit = 50, reason } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { rows } = await query(
    `SELECT fe.*, u.name AS user_name, u.phone, u.risk_score
     FROM fraud_events fe
     LEFT JOIN users u ON u.id = fe.user_id
     WHERE fe.reviewed_at IS NULL
       ${reason ? `AND fe.reason = '${reason}'` : ''}
     ORDER BY fe.created_at DESC
     LIMIT $1 OFFSET $2`,
    [parseInt(limit), offset]
  );

  const { rows: stats } = await query(
    `SELECT reason, COUNT(*) AS count
     FROM fraud_events
     WHERE created_at > NOW() - INTERVAL '7 days'
     GROUP BY reason ORDER BY count DESC`
  );

  res.json({ events: rows, stats });
}

/**
 * GET /admin/sla  — SLA overdue dashboard
 */
async function getSLADashboard(req, res) {
  const { rows } = await query(
    `SELECT r.id, r.severity, r.status, r.created_at,
            r.sla_deadline,
            EXTRACT(EPOCH FROM (NOW() - r.sla_deadline)) / 3600 AS overdue_hours,
            w.name AS ward_name, z.name AS zone_name
     FROM reports r
     LEFT JOIN ghmc_wards w ON w.id = r.ward_id
     LEFT JOIN ghmc_zones z ON z.id = r.zone_id
     WHERE r.sla_deadline < NOW()
       AND r.status NOT IN ('fixed','rejected','fraudulent')
     ORDER BY r.sla_deadline ASC
     LIMIT 200`
  );
  res.json(rows);
}

/**
 * GET /admin/analytics/summary
 */
async function getAnalyticsSummary(req, res) {
  const { days = 30 } = req.query;

  const { rows: summary } = await query(
    `SELECT
       COUNT(*) AS total_reports,
       COUNT(*) FILTER (WHERE status = 'fixed') AS fixed,
       COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
       COUNT(*) FILTER (WHERE status IN ('submitted','verified','assigned')) AS pending,
       COUNT(*) FILTER (WHERE status = 'fraudulent') AS fraudulent,
       AVG(EXTRACT(EPOCH FROM (fixed_at - created_at)) / 3600)
         FILTER (WHERE status = 'fixed') AS avg_fix_hours
     FROM reports
     WHERE created_at > NOW() - ($1 || ' days')::interval`,
    [parseInt(days)]
  );

  const { rows: byZone } = await query(
    `SELECT z.name AS zone, COUNT(*) AS count, COUNT(*) FILTER (WHERE r.status = 'fixed') AS fixed
     FROM reports r
     JOIN ghmc_zones z ON z.id = r.zone_id
     WHERE r.created_at > NOW() - ($1 || ' days')::interval
     GROUP BY z.name ORDER BY count DESC`,
    [parseInt(days)]
  );

  const { rows: bySeverity } = await query(
    `SELECT severity, COUNT(*) AS count
     FROM reports
     WHERE created_at > NOW() - ($1 || ' days')::interval
     GROUP BY severity`,
    [parseInt(days)]
  );

  res.json({ summary: summary[0], byZone, bySeverity });
}

/**
 * GET /admin/officers/performance  — officer SLA performance (from mat view)
 * Query params: designation, zone_id, circle_id, ward_id
 */
async function getOfficerPerformance(req, res) {
  const { designation, zone_id, circle_id, ward_id } = req.query;

  const conditions = [];
  const params     = [];

  if (designation) { params.push(designation); conditions.push(`o.designation = $${params.length}`); }
  if (zone_id)     { params.push(zone_id);     conditions.push(`o.zone_id = $${params.length} OR o.ward_id IN (SELECT id FROM ghmc_wards WHERE zone_id = $${params.length})`); }
  if (circle_id)   { params.push(circle_id);   conditions.push(`o.circle_id = $${params.length} OR o.ward_id IN (SELECT id FROM ghmc_wards WHERE circle_id = $${params.length})`); }
  if (ward_id)     { params.push(ward_id);     conditions.push(`o.ward_id = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Pull from the materialized view if fresh, else compute live
  const { rows } = await query(
    `SELECT
       op.officer_id,
       op.officer_name,
       op.designation,
       op.total_assigned,
       op.fixed_count,
       op.sla_breached,
       op.fixed_within_sla,
       op.sla_compliance_pct,
       ROUND(op.avg_fix_hours::numeric, 1) AS avg_fix_hours,
       op.computed_at,
       w.name  AS ward_name,
       w.ward_number,
       c.name  AS circle_name,
       z.name  AS zone_name,
       o.phone, o.email, o.employee_id
     FROM mv_officer_performance op
     JOIN ghmc_officers o ON o.id = op.officer_id
     LEFT JOIN ghmc_wards   w ON w.id = o.ward_id
     LEFT JOIN ghmc_circles c ON c.id = o.circle_id
     LEFT JOIN ghmc_zones   z ON z.id = o.zone_id
     ${where}
     ORDER BY op.sla_compliance_pct ASC NULLS LAST, op.sla_breached DESC`
  , params);

  res.json(rows);
}

/**
 * GET /admin/sla/heatmap  — zone-level SLA RAG heatmap (from mat view)
 */
async function getSLAHeatmap(req, res) {
  const { rows } = await query(
    `SELECT
       h.zone_id, h.zone_name,
       h.total_open, h.sla_breached, h.sla_ok,
       h.breach_pct, h.rag_status, h.computed_at,
       -- circle-level breakdown
       json_agg(
         jsonb_build_object(
           'circle_id',   c.id,
           'circle_name', c.name,
           'open',        (
             SELECT COUNT(*) FROM reports r2
             WHERE r2.circle_id = c.id
               AND r2.status NOT IN ('fixed','rejected','fraudulent')
               AND r2.created_at > NOW() - INTERVAL '90 days'
           ),
           'breached',    (
             SELECT COUNT(*) FROM reports r2
             WHERE r2.circle_id = c.id
               AND r2.sla_deadline < NOW()
               AND r2.status NOT IN ('fixed','rejected','fraudulent')
               AND r2.created_at > NOW() - INTERVAL '90 days'
           )
         ) ORDER BY c.name
       ) AS circles
     FROM mv_sla_heatmap h
     JOIN ghmc_circles c ON c.zone_id = h.zone_id
     GROUP BY h.zone_id, h.zone_name, h.total_open, h.sla_breached,
              h.sla_ok, h.breach_pct, h.rag_status, h.computed_at
     ORDER BY h.breach_pct DESC`
  );
  res.json(rows);
}

/**
 * POST /admin/performance/refresh  — manual refresh of mat views (supervisor+)
 */
async function refreshPerformanceViews(req, res) {
  await query('SELECT refresh_performance_views()');
  res.json({ message: 'Performance views refreshed', refreshed_at: new Date().toISOString() });
}

/**
 * GET /admin/officers  — list officers with scope info (for drawer dropdowns)
 */
async function listOfficers(req, res) {
  const { ward_id, circle_id, zone_id, designation } = req.query;
  const conditions = ['o.is_active = TRUE'];
  const params     = [];

  if (designation) { params.push(designation); conditions.push(`o.designation = $${params.length}`); }
  if (ward_id)     { params.push(ward_id);     conditions.push(`o.ward_id = $${params.length}`); }
  if (circle_id)   { params.push(circle_id);   conditions.push(`o.circle_id = $${params.length}`); }
  if (zone_id)     { params.push(zone_id);     conditions.push(`o.zone_id = $${params.length}`); }

  const { rows } = await query(
    `SELECT o.id, o.name, o.designation, o.employee_id,
            o.phone, o.email, o.is_hq,
            w.name AS ward_name, w.ward_number,
            c.name AS circle_name,
            z.name AS zone_name
     FROM ghmc_officers o
     LEFT JOIN ghmc_wards   w ON w.id = o.ward_id
     LEFT JOIN ghmc_circles c ON c.id = o.circle_id
     LEFT JOIN ghmc_zones   z ON z.id = o.zone_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY o.designation, o.name`,
    params
  );
  res.json(rows);
}

module.exports = {
  getDashboardQueue, updateReportStatus,
  banUser, banDevice, getFraudDashboard,
  getSLADashboard, getAnalyticsSummary,
  getOfficerPerformance, getSLAHeatmap,
  refreshPerformanceViews, listOfficers,
};
