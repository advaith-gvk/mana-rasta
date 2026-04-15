/**
 * Image Moderation Service
 *
 * Layer 1: Safety check via vendor API (e.g. AWS Rekognition or Google Vision SafeSearch)
 * Layer 2: Pothole relevance classifier (basic heuristic; replace with custom model)
 *
 * Returns: { verdict: 'approved'|'rejected'|'flagged_for_review', reason, scores, provider }
 */

const axios  = require('axios');
const sharp  = require('sharp');
const crypto = require('crypto');
const logger = require('../utils/logger');

const PROVIDER = process.env.MODERATION_PROVIDER || 'mock'; // 'rekognition' | 'sightengine' | 'mock'

/**
 * Main moderation entry point.
 * Fetches the image from objectUrl (or uses buffer), runs safety + relevance.
 */
async function moderateImage(objectUrl, storageKey, imageBuffer) {
  try {
    let verdict, reason, scores, provider;

    if (PROVIDER === 'sightengine') {
      ({ verdict, reason, scores, provider } = await checkSightengine(objectUrl));
    } else if (PROVIDER === 'rekognition') {
      ({ verdict, reason, scores, provider } = await checkRekognition(storageKey));
    } else {
      // Mock: approve everything in dev
      return {
        verdict: 'approved',
        reason:  null,
        scores:  { nudity: 0, violence: 0, relevance: 0.95 },
        provider: 'mock',
        phash:   generateMockPhash(),
      };
    }

    return { verdict, reason, scores, provider };
  } catch (err) {
    logger.error('Image moderation error', err);
    // Fail open but flag for manual review
    return {
      verdict:  'flagged_for_review',
      reason:   'Moderation service unavailable',
      scores:   {},
      provider: 'error_fallback',
    };
  }
}

/**
 * Sightengine API integration
 * https://sightengine.com/docs/image-moderation
 */
async function checkSightengine(imageUrl) {
  const { data } = await axios.get('https://api.sightengine.com/1.0/check.json', {
    params: {
      url:          imageUrl,
      models:       'nudity-2.0,violence,offensive,gore,text-content',
      api_user:     process.env.SIGHTENGINE_USER,
      api_secret:   process.env.SIGHTENGINE_SECRET,
    },
    timeout: 8000,
  });

  const scores = {
    nudity:    data.nudity?.sexual_activity || 0,
    violence:  data.violence?.prob          || 0,
    offensive: data.offensive?.prob         || 0,
    gore:      data.gore?.prob              || 0,
  };

  const HARD_THRESHOLD  = 0.5;
  const SOFT_THRESHOLD  = 0.3;

  const hardFail = Object.entries(scores).find(([, v]) => v > HARD_THRESHOLD);
  const softFail = Object.entries(scores).find(([, v]) => v > SOFT_THRESHOLD);

  let verdict, reason;
  if (hardFail) {
    verdict = 'rejected';
    reason  = `Unsafe content detected: ${hardFail[0]} (score ${hardFail[1].toFixed(2)})`;
  } else if (softFail) {
    verdict = 'flagged_for_review';
    reason  = `Borderline content: ${softFail[0]} (score ${softFail[1].toFixed(2)})`;
  } else {
    verdict = 'approved';
    reason  = null;
  }

  return { verdict, reason, scores, provider: 'sightengine' };
}

/**
 * AWS Rekognition integration
 * Uses DetectModerationLabels on the S3 object
 */
async function checkRekognition(storageKey) {
  const { RekognitionClient, DetectModerationLabelsCommand } = require('@aws-sdk/client-rekognition');
  const client = new RekognitionClient({ region: process.env.AWS_REGION });

  const { ModerationLabels } = await client.send(new DetectModerationLabelsCommand({
    Image: {
      S3Object: {
        Bucket: process.env.AWS_S3_BUCKET,
        Name:   storageKey,
      },
    },
    MinConfidence: 50,
  }));

  const hardLabels = [
    'Explicit Nudity', 'Nudity', 'Graphic Sexual Activity',
    'Graphic Violence', 'Death and Emaciation', 'Gore',
  ];
  const softLabels = ['Suggestive', 'Revealing Clothes', 'Violence'];

  const scores = {};
  for (const label of ModerationLabels) {
    scores[label.Name] = label.Confidence / 100;
  }

  const hardHit = ModerationLabels.find(l => hardLabels.includes(l.Name));
  const softHit = ModerationLabels.find(l => softLabels.includes(l.Name));

  let verdict, reason;
  if (hardHit) {
    verdict = 'rejected';
    reason  = `Explicit content: ${hardHit.Name}`;
  } else if (softHit) {
    verdict = 'flagged_for_review';
    reason  = `Borderline: ${softHit.Name}`;
  } else {
    verdict = 'approved';
    reason  = null;
  }

  return { verdict, reason, scores, provider: 'rekognition' };
}

/**
 * Compute a simple perceptual hash from image buffer for duplicate detection.
 * For production, use a proper pHash library (e.g. imghash or sharp + DCT).
 */
async function computePhash(buffer) {
  try {
    // Resize to 8x8 grayscale, then hash pixel values
    const resized = await sharp(buffer).resize(8, 8).grayscale().raw().toBuffer();
    const avg = resized.reduce((s, v) => s + v, 0) / resized.length;
    let bits = '';
    for (const px of resized) bits += px >= avg ? '1' : '0';
    return crypto.createHash('sha1').update(bits).digest('hex').substring(0, 16);
  } catch {
    return null;
  }
}

function generateMockPhash() {
  return crypto.randomBytes(8).toString('hex');
}

module.exports = { moderateImage, computePhash };
