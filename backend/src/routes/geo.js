const express = require('express');
const router  = express.Router();
const Joi     = require('joi');
const { authenticate } = require('../middleware/auth');
const { validateQuery } = require('../middleware/validate');
const { query } = require('../config/db');
const { cacheGet, cacheSet } = require('../config/redis');

// GET /geo/resolve?lat=17.4&lng=78.4  — resolve GPS to ward
router.get('/resolve',
  authenticate,
  validateQuery(Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
  })),
  async (req, res) => {
    const { lat, lng } = req.query;
    const cacheKey = `geo:resolve:${parseFloat(lat).toFixed(5)}:${parseFloat(lng).toFixed(5)}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const { rows } = await query(
      `SELECT w.id AS ward_id, w.name AS ward_name, w.ward_number,
              c.id AS circle_id, c.name AS circle_name,
              z.id AS zone_id, z.name AS zone_name
       FROM ghmc_wards w
       JOIN ghmc_circles c ON c.id = w.circle_id
       JOIN ghmc_zones   z ON z.id = w.zone_id
       WHERE ST_Contains(w.boundary, ST_SetSRID(ST_MakePoint($2, $1), 4326))
       LIMIT 1`,
      [parseFloat(lat), parseFloat(lng)]
    );

    const result = rows[0] || { ward_id: null, ward_name: null, is_outside_ghmc: true };
    await cacheSet(cacheKey, result, 86400); // cache for 24h
    res.json(result);
  }
);

// GET /geo/viewport  — reports within a map viewport bounding box
router.get('/viewport',
  authenticate,
  validateQuery(Joi.object({
    minLat: Joi.number().required(),
    maxLat: Joi.number().required(),
    minLng: Joi.number().required(),
    maxLng: Joi.number().required(),
    limit:  Joi.number().integer().min(1).max(500).default(200),
  })),
  async (req, res) => {
    const { minLat, maxLat, minLng, maxLng, limit } = req.query;
    const { rows } = await query(
      `SELECT r.id, r.severity, r.status, r.latitude, r.longitude,
              r.acknowledgment_count, r.priority_score,
              ri.thumbnail_url
       FROM reports r
       LEFT JOIN LATERAL (
         SELECT thumbnail_url FROM report_images WHERE report_id = r.id LIMIT 1
       ) ri ON TRUE
       WHERE ST_Within(
         r.location,
         ST_MakeEnvelope($2, $1, $4, $3, 4326)
       )
       AND r.status NOT IN ('rejected','fraudulent')
       ORDER BY r.priority_score DESC
       LIMIT $5`,
      [parseFloat(minLat), parseFloat(minLng),
       parseFloat(maxLat), parseFloat(maxLng),
       parseInt(limit)]
    );
    res.json(rows);
  }
);

// GET /geo/hotspots  — cluster centers with report counts
router.get('/hotspots',
  authenticate,
  validateQuery(Joi.object({
    zoneId:   Joi.string().uuid(),
    radiusM:  Joi.number().min(100).max(10000).default(500),
    minCount: Joi.number().integer().min(2).default(3),
    days:     Joi.number().integer().min(1).max(365).default(30),
  })),
  async (req, res) => {
    const { zoneId, radiusM = 500, minCount = 3, days = 30 } = req.query;
    const cacheKey = `geo:hotspots:${zoneId || 'all'}:${radiusM}:${days}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const params = [parseInt(radiusM), parseInt(days)];
    const zoneClause = zoneId ? `AND r.zone_id = $${params.push(zoneId)}` : '';

    // Use PostGIS ST_ClusterDBSCAN for hotspot clustering
    const { rows } = await query(
      `WITH clustered AS (
         SELECT r.id, r.latitude, r.longitude, r.severity,
           ST_ClusterDBSCAN(r.location, eps := $1, minpoints := 2)
             OVER () AS cluster_id
         FROM reports r
         WHERE r.status NOT IN ('rejected','fraudulent')
           AND r.created_at > NOW() - ($2 || ' days')::interval
           ${zoneClause}
       ),
       cluster_centers AS (
         SELECT cluster_id,
           COUNT(*) AS report_count,
           AVG(latitude)  AS center_lat,
           AVG(longitude) AS center_lng,
           MODE() WITHIN GROUP (ORDER BY severity) AS dominant_severity
         FROM clustered
         WHERE cluster_id IS NOT NULL
         GROUP BY cluster_id
         HAVING COUNT(*) >= $${params.push(parseInt(minCount))}
       )
       SELECT * FROM cluster_centers ORDER BY report_count DESC LIMIT 100`,
      params
    );

    await cacheSet(cacheKey, rows, 300); // 5 min
    res.json(rows);
  }
);

// GET /geo/wards  — list wards with open report counts
router.get('/wards', authenticate, async (req, res) => {
  const { zoneId } = req.query;
  const params = [];
  const zoneClause = zoneId ? `AND w.zone_id = $${params.push(zoneId)}` : '';

  const { rows } = await query(
    `SELECT w.id, w.ward_number, w.name,
            c.name AS circle_name,
            z.name AS zone_name,
            COUNT(r.id) AS open_reports,
            COUNT(r.id) FILTER (WHERE r.severity IN ('high','critical')) AS critical_count
     FROM ghmc_wards w
     JOIN ghmc_circles c ON c.id = w.circle_id
     JOIN ghmc_zones   z ON z.id = w.zone_id
     LEFT JOIN reports r ON r.ward_id = w.id
       AND r.status NOT IN ('fixed','rejected','fraudulent')
     WHERE TRUE ${zoneClause}
     GROUP BY w.id, w.ward_number, w.name, c.name, z.name
     ORDER BY open_reports DESC`,
    params
  );
  res.json(rows);
});

module.exports = router;
