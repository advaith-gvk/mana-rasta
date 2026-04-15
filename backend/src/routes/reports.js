const express = require('express');
const router  = express.Router();
const Joi     = require('joi');
const multer  = require('multer');
const { authenticate } = require('../middleware/auth');
const { attachDevice } = require('../middleware/auth');
const { reportSubmitLimiter } = require('../middleware/rateLimiter');
const { validate, validateQuery } = require('../middleware/validate');
const {
  analyzeCaptureFrame,
  submitReport, listMyReports, getReport,
  getNearbyReports, acknowledgeReport, confirmFix,
} = require('../controllers/reportsController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg','image/png','image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG/PNG/WebP images accepted'), false);
  },
});

router.post('/',
  authenticate,
  attachDevice,
  reportSubmitLimiter,
  upload.single('image'),
  validate(Joi.object({
    latitude:    Joi.number().min(-90).max(90).required(),
    longitude:   Joi.number().min(-180).max(180).required(),
    severity:    Joi.string().valid('low','medium','high','critical').default('medium'),
    roadType:    Joi.string().valid('local','arterial','highway','expressway').default('local'),
    description: Joi.string().max(500),
    captureMode: Joi.string().valid('assisted_manual', 'auto_capture').default('assisted_manual'),
    captureMetadata: Joi.string().max(20000),
    sourceType: Joi.string().valid('live_camera', 'gallery_upload', 'screenshot').default('live_camera'),
    liveCaptureRequired: Joi.string().valid('true', 'false').default('true'),
    rawAvailable: Joi.string().valid('true', 'false'),
    rawUsed: Joi.string().valid('true', 'false'),
    filtersApplied: Joi.string().valid('true', 'false'),
    overlayBakedIn: Joi.string().valid('true', 'false'),
    deviceModel: Joi.string().max(120),
    osVersion: Joi.string().max(60),
  })),
  submitReport
);

router.post('/analyze-capture',
  authenticate,
  attachDevice,
  upload.single('image'),
  validate(Joi.object({
    captureMode: Joi.string().valid('assisted_manual', 'auto_capture').default('assisted_manual'),
    captureMetadata: Joi.string().max(20000),
    sourceType: Joi.string().valid('live_camera', 'gallery_upload', 'screenshot').default('live_camera'),
    liveCaptureRequired: Joi.string().valid('true', 'false').default('true'),
    rawAvailable: Joi.string().valid('true', 'false'),
    rawUsed: Joi.string().valid('true', 'false'),
    filtersApplied: Joi.string().valid('true', 'false'),
    overlayBakedIn: Joi.string().valid('true', 'false'),
    deviceModel: Joi.string().max(120),
    osVersion: Joi.string().max(60),
  })),
  analyzeCaptureFrame
);

router.get('/',
  authenticate,
  validateQuery(Joi.object({
    page:   Joi.number().integer().min(1).default(1),
    limit:  Joi.number().integer().min(1).max(100).default(20),
    // Accept single status OR comma-separated list for filter chips
    status: Joi.string().pattern(/^[a-z_]+(,[a-z_]+)*$/).optional(),
  })),
  listMyReports
);

router.get('/nearby',
  authenticate,
  validateQuery(Joi.object({
    lat:     Joi.number().required(),
    lng:     Joi.number().required(),
    radiusM: Joi.number().min(50).max(5000).default(1000),
    limit:   Joi.number().integer().min(1).max(200).default(50),
  })),
  getNearbyReports
);

router.get('/:id', authenticate, getReport);

router.post('/:id/acknowledge',
  authenticate,
  validate(Joi.object({ note: Joi.string().max(200) })),
  acknowledgeReport
);

router.post('/:id/confirm-fix', authenticate, confirmFix);

module.exports = router;
