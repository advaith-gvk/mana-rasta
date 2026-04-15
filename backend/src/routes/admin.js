const express = require('express');
const router  = express.Router();
const Joi     = require('joi');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate, validateQuery }    = require('../middleware/validate');
const {
  getDashboardQueue, updateReportStatus,
  banUser, banDevice, getFraudDashboard,
  getSLADashboard, getAnalyticsSummary,
  getOfficerPerformance, getSLAHeatmap,
  refreshPerformanceViews, listOfficers,
} = require('../controllers/adminController');

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

// ── Reports ───────────────────────────────────────────────
router.get('/reports',
  validateQuery(Joi.object({
    zone_id:         Joi.string().uuid(),
    circle_id:       Joi.string().uuid(),
    ward_id:         Joi.string().uuid(),
    severity:        Joi.string().valid('low','medium','high','critical'),
    status:          Joi.string(),
    min_age_hours:   Joi.number().integer().min(0),
    min_validations: Joi.number().integer().min(0),
    page:            Joi.number().integer().min(1).default(1),
    limit:           Joi.number().integer().min(1).max(200).default(50),
    sort:            Joi.string().valid('priority','oldest','newest','severity').default('priority'),
  })),
  getDashboardQueue
);

router.patch('/reports/:id/status',
  validate(Joi.object({
    status:   Joi.string().valid(
      'under_review','verified','assigned','in_progress',
      'fixed','rejected','fraudulent'
    ).required(),
    note:     Joi.string().max(500),
    assignTo: Joi.string().uuid(),
  })),
  updateReportStatus
);

// ── Users / devices ───────────────────────────────────────
router.post('/users/:id/ban',
  validate(Joi.object({
    banType:      Joi.string().valid('temporary','permanent').required(),
    reason:       Joi.string().max(500).required(),
    durationDays: Joi.number().integer().min(1).max(365).default(7),
  })),
  banUser
);

router.post('/devices/:fingerprint/ban',
  validate(Joi.object({
    banType:      Joi.string().valid('temporary','permanent').required(),
    reason:       Joi.string().max(500).required(),
    durationDays: Joi.number().integer().min(1).max(365).default(7),
  })),
  banDevice
);

// ── Fraud ─────────────────────────────────────────────────
router.get('/fraud', getFraudDashboard);

// ── SLA ───────────────────────────────────────────────────
router.get('/sla',          getSLADashboard);
router.get('/sla/heatmap',  getSLAHeatmap);

// ── Analytics ─────────────────────────────────────────────
router.get('/analytics',    getAnalyticsSummary);

// ── Officers ──────────────────────────────────────────────
router.get('/officers',
  validateQuery(Joi.object({
    ward_id:     Joi.string().uuid(),
    circle_id:   Joi.string().uuid(),
    zone_id:     Joi.string().uuid(),
    designation: Joi.string().valid('AE','DEE','EE','SE','CE','AC_PW'),
  })),
  listOfficers
);

router.get('/officers/performance',
  validateQuery(Joi.object({
    designation: Joi.string().valid('AE','DEE','EE','SE','CE','AC_PW'),
    zone_id:     Joi.string().uuid(),
    circle_id:   Joi.string().uuid(),
    ward_id:     Joi.string().uuid(),
  })),
  getOfficerPerformance
);

router.post('/performance/refresh', refreshPerformanceViews);

module.exports = router;
