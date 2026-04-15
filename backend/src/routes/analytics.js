const express = require('express');
const router  = express.Router();
const Joi     = require('joi');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validateQuery } = require('../middleware/validate');
const { query } = require('../config/db');

router.use(authenticate, requireAdmin);

// GET /analytics/reports/trend  — daily report count trend
router.get('/reports/trend',
  validateQuery(Joi.object({ days: Joi.number().integer().min(7).max(365).default(30) })),
  async (req, res) => {
    const { days } = req.query;
    const { rows } = await query(
      `SELECT DATE(created_at) AS date, COUNT(*) AS total,
              COUNT(*) FILTER (WHERE status = 'fixed') AS fixed,
              COUNT(*) FILTER (WHERE status = 'fraudulent') AS flagged
       FROM reports
       WHERE created_at > NOW() - ($1 || ' days')::interval
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [parseInt(days)]
    );
    res.json(rows);
  }
);

// GET /analytics/zones/summary
router.get('/zones/summary', async (req, res) => {
  const { rows } = await query(
    `SELECT z.name AS zone, z.id,
            COUNT(r.id) AS total,
            COUNT(r.id) FILTER (WHERE r.status NOT IN ('fixed','rejected','fraudulent')) AS open,
            COUNT(r.id) FILTER (WHERE r.status = 'fixed') AS fixed,
            COUNT(r.id) FILTER (WHERE r.sla_deadline < NOW() AND r.status NOT IN ('fixed','rejected','fraudulent')) AS sla_breached,
            AVG(EXTRACT(EPOCH FROM (r.fixed_at - r.created_at))/3600)
              FILTER (WHERE r.status = 'fixed') AS avg_fix_hours
     FROM ghmc_zones z
     LEFT JOIN reports r ON r.zone_id = z.id
       AND r.created_at > NOW() - INTERVAL '90 days'
     GROUP BY z.id, z.name
     ORDER BY open DESC`
  );
  res.json(rows);
});

// GET /analytics/csv  — export CSV
router.get('/csv', async (req, res) => {
  const { rows } = await query(
    `SELECT r.id, r.severity, r.status, r.latitude, r.longitude,
            r.road_type, r.description, r.created_at, r.fixed_at,
            w.name AS ward, c.name AS circle, z.name AS zone,
            u.phone AS reporter_phone
     FROM reports r
     LEFT JOIN ghmc_wards   w ON w.id = r.ward_id
     LEFT JOIN ghmc_circles c ON c.id = r.circle_id
     LEFT JOIN ghmc_zones   z ON z.id = r.zone_id
     LEFT JOIN users u ON u.id = r.user_id
     WHERE r.created_at > NOW() - INTERVAL '90 days'
     ORDER BY r.created_at DESC
     LIMIT 10000`
  );

  const csvHeader = Object.keys(rows[0] || {}).join(',');
  const csvRows   = rows.map(r => Object.values(r).map(v =>
    v === null ? '' : String(v).includes(',') ? `"${v}"` : v
  ).join(','));

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="pothole_reports.csv"');
  res.send([csvHeader, ...csvRows].join('\n'));
});

module.exports = router;
