const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const crypto = require('crypto');
const { computePhash } = require('./moderationService');

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET;
const CDN = process.env.CDN_BASE_URL || `https://${BUCKET}.s3.ap-south-1.amazonaws.com`;

async function uploadImage(file, userId) {
  const buffer = file.buffer;
  const meta = await sharp(buffer, { failOn: 'none' }).metadata();
  const ext =
    file.mimetype === 'image/png' ? 'png' :
    file.mimetype === 'image/webp' ? 'webp' :
    'jpg';
  const id = crypto.randomUUID();
  const sourceKey = `reports/${userId}/${id}_source.${ext}`;
  const normalizedKey = `reports/${userId}/${id}.jpg`;
  const thumbKey = `reports/${userId}/${id}_thumb.jpg`;

  // Preserve original bytes and derive a deterministic RGB asset for inference and previews.
  const normalized = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();

  const thumb = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize(400, 400, { fit: 'cover' })
    .jpeg({ quality: 70 })
    .toBuffer();

  const phash = await computePhash(buffer);

  await Promise.all([
    s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: sourceKey,
      Body: buffer,
      ContentType: file.mimetype,
      Metadata: { uploadedBy: userId, artifact: 'source' },
    })),
    s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: normalizedKey,
      Body: normalized,
      ContentType: 'image/jpeg',
      Metadata: { uploadedBy: userId, artifact: 'normalized' },
    })),
    s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: thumbKey,
      Body: thumb,
      ContentType: 'image/jpeg',
      Metadata: { uploadedBy: userId, artifact: 'thumbnail' },
    })),
  ]);

  return {
    sourceStorageKey: sourceKey,
    sourceUrl: `${CDN}/${sourceKey}`,
    sourceMimeType: file.mimetype,
    sourceFileSizeBytes: file.size,
    storageKey: normalizedKey,
    url: `${CDN}/${normalizedKey}`,
    thumbnailUrl: `${CDN}/${thumbKey}`,
    phash,
    exifMetadata: {
      format: meta.format || null,
      width: meta.width || null,
      height: meta.height || null,
      orientation: meta.orientation || null,
      space: meta.space || null,
      density: meta.density || null,
      hasAlpha: Boolean(meta.hasAlpha),
      exifPresent: Boolean(meta.exif),
    },
    processingPipeline: {
      source_preserved: true,
      normalized_derivative: 'sharp.rotate.resize(2048).jpeg(quality=90)',
      thumbnail_derivative: 'sharp.rotate.resize(400x400,cover).jpeg(quality=70)',
      filters_applied: false,
    },
  };
}

async function deleteImage(storageKey) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: storageKey }));
}

module.exports = { uploadImage, deleteImage };
