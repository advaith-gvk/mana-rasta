const axios = require('axios');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

const MODEL_VERSION = process.env.POTHOLE_ML_MODEL_VERSION || 'python-road-heuristic-v1';
const ML_SERVICE_URL = process.env.POTHOLE_ML_SERVICE_URL || 'http://localhost:8001';
const ML_SERVICE_TIMEOUT_MS = parseInt(process.env.POTHOLE_ML_TIMEOUT_MS || '8000', 10);

async function analyzeCapture({ buffer, mimetype, captureContext = {}, deviceContext = {} }) {
  try {
    const response = await axios.post(
      `${ML_SERVICE_URL}/analyze`,
      {
        image_base64: buffer.toString('base64'),
        mimetype,
        capture_context: captureContext,
        device_context: deviceContext,
      },
      {
        timeout: ML_SERVICE_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const result = response.data || {};
    return {
      ...result,
      model: {
        ...(result.model || {}),
        version: result.model?.version || MODEL_VERSION,
      },
    };
  } catch (error) {
    logger.error('python ml service error', error.message || error);
    if (error.response?.data) {
      logger.error('python ml service response', error.response.data);
    }
    throw new AppError('ML service unavailable', 503);
  }
}

async function logCaptureAttempt(db, payload) {
  await db.query(
    `INSERT INTO report_capture_logs(
       report_id, user_id, device_id, source_ip, capture_status, quality_ready,
       blocked_reason, downgraded_reason, quality_score, quality_flags,
       detection, review, metadata, model_version
     ) VALUES(
       $1, $2, $3, $4::inet, $5, $6, $7, $8, $9, $10::jsonb,
       $11::jsonb, $12::jsonb, $13::jsonb, $14
     )`,
    [
      payload.reportId || null,
      payload.userId,
      payload.deviceId || null,
      payload.sourceIp,
      payload.result.capture_status,
      payload.result.quality_ready,
      payload.result.blocked_reason,
      payload.result.downgraded_reason,
      payload.result.quality_score,
      JSON.stringify(payload.result.quality_flags || {}),
      JSON.stringify(payload.result.detection || {}),
      JSON.stringify(payload.result.review || {}),
      JSON.stringify(payload.result.metadata || {}),
      payload.result.model?.version || MODEL_VERSION,
    ]
  );
}

module.exports = {
  MODEL_VERSION,
  analyzeCapture,
  logCaptureAttempt,
};
