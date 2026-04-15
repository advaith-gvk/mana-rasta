const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/db');

// GET /acknowledgments/mine  — reports the user has acknowledged
router.get('/mine', authenticate, async (req, res) => {
  const { rows } = await query(
    `SELECT a.report_id, a.created_at,
            r.severity, r.status, r.latitude, r.longitude,
            w.name AS ward_name
     FROM acknowledgments a
     JOIN reports r ON r.id = a.report_id
     LEFT JOIN ghmc_wards w ON w.id = r.ward_id
     WHERE a.user_id = $1
     ORDER BY a.created_at DESC
     LIMIT 50`,
    [req.user.id]
  );
  res.json(rows);
});

module.exports = router;
