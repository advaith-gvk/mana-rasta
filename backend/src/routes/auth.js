// routes/auth.js
const express = require('express');
const router  = express.Router();
const Joi     = require('joi');
const { sendOtp, verifyOtp, refreshToken, getMe, updateProfile } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { otpLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');

router.post('/send-otp',
  otpLimiter,
  validate(Joi.object({ phone: Joi.string().pattern(/^\+91[0-9]{10}$/).required() })),
  sendOtp
);

router.post('/verify-otp',
  validate(Joi.object({
    phone:             Joi.string().required(),
    otp:               Joi.string().length(6).required(),
    deviceFingerprint: Joi.string().max(255),
    deviceModel:       Joi.string().max(100),
    platform:          Joi.string().valid('android','ios','web'),
    appVersion:        Joi.string().max(20),
  })),
  verifyOtp
);

router.post('/refresh', refreshToken);
router.get('/me',        authenticate, getMe);
router.patch('/profile', authenticate, validate(Joi.object({
  name:     Joi.string().min(2).max(100),
  email:    Joi.string().email(),
  fcmToken: Joi.string(),
})), updateProfile);

module.exports = router;
