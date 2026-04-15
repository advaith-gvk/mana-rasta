const { v4: uuidv4 } = require('uuid');
const { query, withTransaction } = require('../config/db');
const { cacheGet, cacheSet, cacheDel } = require('../config/redis');
const { uploadImage } = require('../services/storageService');
const { moderateImage } = require('../services/moderationService');
const { runFraudChecks, checkDuplicateImage, logFraudEvent } = require('../services/fraudService');
const { analyzeCapture, logCaptureAttempt } = require('../services/potholeMlService');
const { creditPoints } = require('../services/rewardsService');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

const NEARBY_DUPLICATE_RADIUS_M = 50;

async function analyzeCaptureFrame(req, res) {
  if (!req.file) throw new AppError('Image is required', 400);

  const captureContext = parseCaptureContext(req.body);
  const analysis = await analyzeCapture({
    buffer: req.file.buffer,
    mimetype: req.file.mimetype,
    captureContext,
    deviceContext: {
      deviceModel: captureContext.device_model,
      osVersion: captureContext.os_version,
    },
  });

  await logCaptureAttempt({ query }, {
    reportId: null,
    userId: req.user.id,
    deviceId: req.deviceId,
    sourceIp: req.ip,
    result: analysis,
  }).catch((err) => logger.error('capture analysis log error', err));

  res.json(analysis);
}

/**
 * POST /reports
 * Submit a new pothole report with image upload.
 */
async function submitReport(req, res) {
  const userId = req.user.id;
  const deviceId = req.deviceId;
  const sourceIp = req.ip;

  const {
    latitude, longitude, severity = 'medium',
    roadType = 'local', description,
  } = req.body;

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lng)) throw new AppError('Invalid coordinates', 400);
  if (lat < 17.0 || lat > 18.0 || lng < 78.0 || lng > 79.0) {
    throw new AppError('Location outside Hyderabad region', 400);
  }

  if (!req.file) throw new AppError('Image is required', 400);

  const captureContext = parseCaptureContext(req.body);
  const mlResult = await analyzeCapture({
    buffer: req.file.buffer,
    mimetype: req.file.mimetype,
    captureContext,
    deviceContext: {
      deviceModel: captureContext.device_model,
      osVersion: captureContext.os_version,
    },
  });

  if (!mlResult.quality_ready || !mlResult.detection.reportable) {
    await logCaptureAttempt({ query }, {
      reportId: null,
      userId,
      deviceId,
      sourceIp,
      result: mlResult,
    }).catch((err) => logger.error('blocked capture log error', err));
    throw new AppError(`Image blocked: ${mlResult.blocked_reason || mlResult.downgraded_reason || 'capture_not_usable'}`, 422);
  }

  await runFraudChecks({ userId, deviceId, sourceIp, lat, lng });

  const uploadResult = await uploadImage(req.file, userId);
  const modResult = await moderateImage(
    uploadResult.sourceUrl || uploadResult.url,
    uploadResult.sourceStorageKey || uploadResult.storageKey,
    req.file.buffer
  );

  if (modResult.verdict === 'rejected') {
    await logCaptureAttempt({ query }, {
      reportId: null,
      userId,
      deviceId,
      sourceIp,
      result: {
        ...mlResult,
        capture_status: 'blocked',
        quality_ready: false,
        blocked_reason: 'moderation_rejected',
        guidance_prompt: 'Image blocked.',
      },
    }).catch((err) => logger.error('moderation block log error', err));
    throw new AppError(`Image rejected: ${modResult.reason}`, 422);
  }

  const isDuplicateImage = await checkDuplicateImage(uploadResult.phash, userId);
  if (isDuplicateImage) {
    await logFraudEvent({
      userId,
      deviceId,
      sourceIp,
      reason: 'duplicate_image',
      details: { phash: uploadResult.phash },
    }).catch(logger.error);
    throw new AppError('Duplicate image detected for a recent report', 409);
  }

  const { rows: geoRows } = await query(
    'SELECT * FROM resolve_report_location($1, $2)', [lat, lng]
  );
  const geo = geoRows[0] || {};

  const { rows: nearbyRows } = await query(
    `SELECT id, cluster_id FROM reports
     WHERE ST_DWithin(
       location::geography,
       ST_MakePoint($1, $2)::geography,
       $3
     )
     AND status NOT IN ('rejected','fraudulent')
     ORDER BY created_at DESC LIMIT 1`,
    [lng, lat, NEARBY_DUPLICATE_RADIUS_M]
  );

  const nearbyReport = nearbyRows[0] || null;
  const clusterId = nearbyReport?.cluster_id || (nearbyReport ? nearbyReport.id : null);

  const reportId = await withTransaction(async (client) => {
    const id = uuidv4();
    const effectiveSeverity = normalizeSeverity(severity, mlResult.detection.severity);
    const slaHours = { critical: 24, high: 48, medium: 96, low: 168 };
    const slaH = slaHours[effectiveSeverity] || 96;

    const { rows } = await client.query(
      `INSERT INTO reports(
         id, user_id, location, latitude, longitude, severity, road_type,
         description, ward_id, circle_id, zone_id, cluster_id,
         source_ip, device_id, is_outside_ghmc, sla_deadline,
         ae_officer_id, ee_officer_id, hq_officer_id
       ) VALUES(
         $1, $2,
         ST_SetSRID(ST_MakePoint($4, $3), 4326),
         $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::inet, $13,
         $14, NOW() + ($15 || ' hours')::interval,
         $16, $17, $18
       ) RETURNING id`,
      [
        id, userId, lat, lng, effectiveSeverity, roadType, description,
        geo.ward_id, geo.circle_id, geo.zone_id,
        clusterId, sourceIp, deviceId,
        geo.is_outside_ghmc,
        slaH,
        geo.ae_officer_id || null,
        geo.ee_officer_id || null,
        geo.hq_officer_id || null,
      ]
    );

    await client.query(
      `INSERT INTO report_images(
         report_id, storage_key, url, thumbnail_url, file_size_bytes,
         mime_type, phash, moderation_verdict, moderation_reason,
         moderation_score, moderation_provider, source_storage_key,
         source_url, source_mime_type, source_file_size_bytes, exif_metadata,
         capture_metadata, quality_assessment, ml_inference, processing_pipeline
       ) VALUES(
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
         $13,$14,$15,$16::jsonb,$17::jsonb,$18::jsonb,$19::jsonb,$20::jsonb
       )`,
      [
        id,
        uploadResult.storageKey,
        uploadResult.url,
        uploadResult.thumbnailUrl,
        req.file.size,
        'image/jpeg',
        uploadResult.phash,
        modResult.verdict,
        modResult.reason,
        JSON.stringify(modResult.scores),
        modResult.provider,
        uploadResult.sourceStorageKey,
        uploadResult.sourceUrl,
        uploadResult.sourceMimeType,
        uploadResult.sourceFileSizeBytes,
        JSON.stringify(uploadResult.exifMetadata || {}),
        JSON.stringify(mlResult.metadata || {}),
        JSON.stringify({
          quality_ready: mlResult.quality_ready,
          quality_score: mlResult.quality_score,
          quality_flags: mlResult.quality_flags,
          quality_metrics: mlResult.quality_metrics,
          blocked_reason: mlResult.blocked_reason,
          downgraded_reason: mlResult.downgraded_reason,
          guidance_prompt: mlResult.guidance_prompt,
        }),
        JSON.stringify({
          detection: mlResult.detection,
          review: mlResult.review,
          model: mlResult.model,
        }),
        JSON.stringify(uploadResult.processingPipeline || {}),
      ]
    );

    await client.query(
      'UPDATE reports SET priority_score = compute_priority_score($1) WHERE id = $1', [id]
    );

    await client.query(
      `UPDATE user_profiles
       SET total_reports = total_reports + 1, last_report_date = CURRENT_DATE
       WHERE user_id = $1`,
      [userId]
    );

    return rows[0].id;
  });

  await logCaptureAttempt({ query }, {
    reportId,
    userId,
    deviceId,
    sourceIp,
    result: mlResult,
  }).catch((err) => logger.error('accepted capture log error', err));

  creditPoints(userId, 'report_submitted', reportId, {
    wardId: geo.ward_id,
    isFirstInWard: !nearbyReport,
  }).catch((err) => logger.error('creditPoints error', err));

  await query(
    `INSERT INTO report_status_history(report_id, to_status, changed_by, note)
     VALUES($1, 'submitted', $2, 'Citizen submitted')`,
    [reportId, userId]
  );

  if (modResult.verdict === 'flagged_for_review' || mlResult.review.needs_human_review) {
    await query(
      `INSERT INTO moderation_logs(report_id, image_id, action, reason, details)
       SELECT $1, ri.id, 'flagged', $2, $3::jsonb
       FROM report_images ri WHERE ri.report_id = $1 LIMIT 1`,
      [
        reportId,
        modResult.reason || mlResult.review.reason || 'ml_review',
        JSON.stringify({
          moderation: modResult.scores,
          ml_review: mlResult.review,
          hard_negative_scores: mlResult.detection.hard_negative_scores,
        }),
      ]
    );
  }

  await cacheDel(`reports:user:${userId}`);

  res.status(201).json({
    reportId,
    wardId: geo.ward_id,
    circleId: geo.circle_id,
    zoneId: geo.zone_id,
    status: 'submitted',
    imageStatus: modResult.verdict,
    ml: {
      capture_status: mlResult.capture_status,
      quality_score: mlResult.quality_score,
      confidence: mlResult.detection.confidence,
      severity: mlResult.detection.severity,
      review: mlResult.review,
    },
  });
}

/**
 * GET /reports  - citizen's own reports with pagination
 */
async function listMyReports(req, res) {
  const { page = 1, limit = 20, status } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const cacheKey = `reports:user:${req.user.id}:${page}:${status || 'all'}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return res.json(cached);

  const params = [req.user.id, parseInt(limit), offset];
  let statusClause = '';
  if (status) {
    const statuses = status.split(',').map((s) => s.trim()).filter(Boolean);
    if (statuses.length === 1) {
      statusClause = `AND r.status = $${params.push(statuses[0])}`;
    } else if (statuses.length > 1) {
      const placeholders = statuses.map((s) => `$${params.push(s)}`).join(', ');
      statusClause = `AND r.status IN (${placeholders})`;
    }
  }

  const { rows } = await query(
    `SELECT r.id, r.severity, r.status, r.priority_score,
            r.latitude, r.longitude, r.address_text, r.description,
            r.acknowledgment_count, r.created_at, r.fixed_at,
            r.citizen_verified, r.igs_complaint_id,
            EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 86400 AS days_ago,
            w.name AS ward_name, z.name AS zone_name,
            ae_off.name AS ae_name,
            COALESCE(pt.total_earned, 20) AS points_earned,
            ri.url AS image_url, ri.thumbnail_url
     FROM reports r
     LEFT JOIN ghmc_wards w         ON w.id = r.ward_id
     LEFT JOIN ghmc_zones z         ON z.id = r.zone_id
     LEFT JOIN ghmc_officers ae_off ON ae_off.id = r.ae_officer_id
     LEFT JOIN LATERAL (
       SELECT url, thumbnail_url FROM report_images
       WHERE report_id = r.id ORDER BY created_at LIMIT 1
     ) ri ON TRUE
     LEFT JOIN LATERAL (
       SELECT SUM(points_awarded) AS total_earned
       FROM points_ledger
       WHERE report_id = r.id AND user_id = $1
     ) pt ON TRUE
     WHERE r.user_id = $1 ${statusClause}
     ORDER BY r.created_at DESC
     LIMIT $2 OFFSET $3`,
    params
  );

  const data = rows.map((r) => ({
    ...r,
    days_ago: Math.floor(parseFloat(r.days_ago) || 0),
  }));

  const result = { data, page: parseInt(page), limit: parseInt(limit) };
  await cacheSet(cacheKey, result, 60);
  res.json(result);
}

/**
 * GET /reports/:id - single report detail
 */
async function getReport(req, res) {
  const { id } = req.params;
  const { rows } = await query(
    `SELECT r.*,
            w.name AS ward_name, w.ward_number,
            c.name AS circle_name,
            z.name AS zone_name,
            u.name AS reporter_name,
            u.phone AS reporter_phone,
            u.risk_score AS user_risk,
            jsonb_build_object(
              'ae', jsonb_build_object(
                'id',          ae_off.id,
                'name',        ae_off.name,
                'designation', ae_off.designation,
                'phone',       ae_off.phone,
                'email',       ae_off.email,
                'employee_id', ae_off.employee_id
              ),
              'ee', jsonb_build_object(
                'id',          ee_off.id,
                'name',        ee_off.name,
                'designation', ee_off.designation,
                'phone',       ee_off.phone,
                'email',       ee_off.email,
                'employee_id', ee_off.employee_id
              ),
              'hq', jsonb_build_object(
                'id',          hq_off.id,
                'name',        hq_off.name,
                'designation', hq_off.designation,
                'phone',       hq_off.phone,
                'email',       hq_off.email,
                'employee_id', hq_off.employee_id
              )
            ) AS redressal_chain,
            json_agg(DISTINCT jsonb_build_object(
              'url', ri.url, 'thumbnail', ri.thumbnail_url,
              'moderation', ri.moderation_verdict,
              'quality', ri.quality_assessment,
              'ml', ri.ml_inference
            )) AS images,
            json_agg(DISTINCT jsonb_build_object(
              'from', rsh.from_status, 'to', rsh.to_status,
              'note', rsh.note, 'at', rsh.created_at
            )) AS history
     FROM reports r
     LEFT JOIN ghmc_wards   w   ON w.id = r.ward_id
     LEFT JOIN ghmc_circles c   ON c.id = r.circle_id
     LEFT JOIN ghmc_zones   z   ON z.id = r.zone_id
     LEFT JOIN users        u   ON u.id = r.user_id
     LEFT JOIN ghmc_officers ae_off ON ae_off.id = r.ae_officer_id
     LEFT JOIN ghmc_officers ee_off ON ee_off.id = r.ee_officer_id
     LEFT JOIN ghmc_officers hq_off ON hq_off.id = r.hq_officer_id
     LEFT JOIN report_images ri ON ri.report_id = r.id
     LEFT JOIN report_status_history rsh ON rsh.report_id = r.id
     WHERE r.id = $1
     GROUP BY r.id,
              w.name, w.ward_number, c.name, z.name,
              u.name, u.phone, u.risk_score,
              ae_off.id, ae_off.name, ae_off.designation, ae_off.phone, ae_off.email, ae_off.employee_id,
              ee_off.id, ee_off.name, ee_off.designation, ee_off.phone, ee_off.email, ee_off.employee_id,
              hq_off.id, hq_off.name, hq_off.designation, hq_off.phone, hq_off.email, hq_off.employee_id`,
    [id]
  );
  if (!rows.length) throw new AppError('Report not found', 404);
  res.json(rows[0]);
}

/**
 * GET /reports/nearby - reports within viewport/radius
 */
async function getNearbyReports(req, res) {
  const { lat, lng, radiusM = 1000, limit = 50 } = req.query;

  const { rows } = await query(
    `SELECT r.id, r.severity, r.status, r.latitude, r.longitude,
            r.acknowledgment_count, r.priority_score,
            ri.thumbnail_url,
            ST_Distance(r.location::geography, ST_MakePoint($2,$1)::geography) AS distance_m
     FROM reports r
     LEFT JOIN LATERAL (
       SELECT thumbnail_url FROM report_images WHERE report_id = r.id LIMIT 1
     ) ri ON TRUE
     WHERE ST_DWithin(
       r.location::geography,
       ST_MakePoint($2, $1)::geography,
       $3
     )
     AND r.status NOT IN ('rejected','fraudulent')
     ORDER BY distance_m ASC
     LIMIT $4`,
    [parseFloat(lat), parseFloat(lng), parseInt(radiusM), parseInt(limit)]
  );
  res.json(rows);
}

/**
 * POST /reports/:id/acknowledge
 */
async function acknowledgeReport(req, res) {
  const { id } = req.params;
  const userId = req.user.id;

  const { rows: rRows } = await query('SELECT id, user_id FROM reports WHERE id = $1', [id]);
  if (!rRows.length) throw new AppError('Report not found', 404);
  if (rRows[0].user_id === userId) throw new AppError('Cannot acknowledge your own report', 400);

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO acknowledgments(report_id, user_id, note)
       VALUES($1, $2, $3)
       ON CONFLICT(report_id, user_id) DO NOTHING`,
      [id, userId, req.body.note]
    );
    await client.query(
      `UPDATE reports
       SET acknowledgment_count = (SELECT COUNT(*) FROM acknowledgments WHERE report_id = $1),
           priority_score = compute_priority_score($1)
       WHERE id = $1`,
      [id]
    );
  });

  creditPoints(userId, 'acknowledgment_given', id).catch(logger.error);
  res.json({ message: 'Acknowledged' });
}

// POST /reports/:id/confirm-fix
async function confirmFix(req, res) {
  const { id } = req.params;
  const userId = req.user.id;

  const { rows } = await query(
    'SELECT id, user_id, status, citizen_verified FROM reports WHERE id = $1',
    [id]
  );
  if (!rows.length) throw new AppError('Report not found', 404);
  const report = rows[0];
  if (report.user_id !== userId) throw new AppError('Not your report', 403);
  if (report.status !== 'fixed') throw new AppError('Report not marked fixed yet', 400);
  if (report.citizen_verified) throw new AppError('Already verified', 409);

  await query(
    `UPDATE reports
        SET citizen_verified    = true,
            citizen_verified_at = NOW()
      WHERE id = $1`,
    [id]
  );

  creditPoints(userId, 'fix_confirmed', id).catch(logger.error);

  res.json({ message: 'Fix confirmed', bonus_points: 10 });
}

function parseCaptureContext(body) {
  const fallback = {
    capture_mode: body.captureMode || 'assisted_manual',
    source_type: body.sourceType || 'live_camera',
    live_capture_required: body.liveCaptureRequired !== 'false',
    raw_available: body.rawAvailable === 'true',
    raw_used: body.rawUsed === 'true',
    filters_applied: body.filtersApplied === 'true',
    overlay_baked_in: body.overlayBakedIn === 'true',
    device_model: body.deviceModel || null,
    os_version: body.osVersion || null,
  };

  if (!body.captureMetadata) return fallback;
  try {
    return { ...fallback, ...JSON.parse(body.captureMetadata) };
  } catch {
    return fallback;
  }
}

function normalizeSeverity(requestedSeverity, detectedSeverity) {
  if (requestedSeverity === 'critical') return 'critical';
  if (!detectedSeverity) return requestedSeverity;
  if (requestedSeverity === 'high' && detectedSeverity === 'low') return 'high';
  return detectedSeverity;
}

module.exports = {
  analyzeCaptureFrame,
  submitReport,
  listMyReports,
  getReport,
  getNearbyReports,
  acknowledgeReport,
  confirmFix,
};
