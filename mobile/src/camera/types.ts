/**
 * camera/types.ts
 * ─────────────────────────────────────────────────────────────
 * Shared types, constants, and threshold config for the gated
 * camera capture pipeline.  All threshold values live here so
 * they can be overridden at startup from remote-config without
 * touching any logic module.
 */

// ── Capture state machine ─────────────────────────────────────

export type CaptureState =
  | 'INIT'        // module loading, sensors initialising
  | 'PERMISSION'  // waiting for / requesting camera permission
  | 'PREVIEW'     // camera active, analyzer not yet seeded
  | 'ANALYZING'   // frames arriving, quality checked, not yet passing
  | 'READY'       // consecutive-pass gate cleared → shutter unlocked
  | 'CAPTURING'   // shutter fired, saving in progress
  | 'REVIEW'      // captured image displayed for accept / retake
  | 'ERROR';      // unrecoverable condition (permission denied, hw error, etc.)

export type CaptureError =
  | 'permission_denied'
  | 'permission_unavailable'
  | 'camera_hardware'
  | 'storage'
  | 'analyzer';

// ── Per-frame quality report ──────────────────────────────────

/**
 * Produced by FrameAnalyzer every analysis cycle.
 * All scores are in [0, 1] where 1 = ideal.
 * `pass` is true only when ALL mandatory gates clear.
 *
 * Extension points (marked with ⚙️) are stubs that should be
 * replaced with a VisionCamera frame-processor or TFLite plugin
 * for production deployments.
 */
export type FrameQuality = {
  /** Unix-ms timestamp of this assessment */
  ts: number;

  // ── Overlay / spatial gates ──────────────────────────────
  /** Subject appears to be within the guide boundary          [⚙️ stub: always true] */
  insideBoundary: boolean;
  /** Fraction of guide box area covered by boundary-fit region [⚙️ stub: 0.60]      */
  boundaryCoverage: number;

  // ── Visual quality ───────────────────────────────────────
  /** Edge-sharpness proxy derived from recent motion stability [derived]             */
  sharpnessScore: number;
  /** Middle-grey exposure quality                              [⚙️ stub: 0.70]      */
  exposureScore: number;
  /** Inverse glare / specular-highlight metric                 [⚙️ stub: 0.70]      */
  glareScore: number;

  // ── Motion / orientation ─────────────────────────────────
  /** 1 = completely still; from DeviceMotion accelerometer     [real]               */
  motionScore: number;
  /** 1 = level; from DeviceMotion rotation.gamma roll          [real]               */
  tiltScore: number;

  // ── Candidate detection ──────────────────────────────────
  /** Pothole / road-damage region present in frame             [⚙️ stub: true]      */
  candidatePresent: boolean;
  /** Fraction of guide box with candidate coverage             [⚙️ stub: 0.50]      */
  candidateCoverage: number;

  // ── Gate result ──────────────────────────────────────────
  /** true when ALL mandatory thresholds are satisfied          */
  pass: boolean;
  /** Ordered list of failing gate keys (highest-priority first) */
  blockingReasons: BlockingReason[];
};

export type BlockingReason =
  | 'outsideBoundary'
  | 'candidateCoverageLow'
  | 'candidateCoverageHigh'
  | 'sharpnessLow'
  | 'motionHigh'
  | 'exposureLow'
  | 'glareHigh'
  | 'tiltHigh';

// ── Human-readable prompt for each blocking reason ────────────

export const BLOCKING_PROMPTS: Record<BlockingReason, string> = {
  outsideBoundary:       'Center pothole inside boundary.',
  candidateCoverageLow:  'Move closer.',
  candidateCoverageHigh: 'Step back.',
  sharpnessLow:          'Hold steady.',
  motionHigh:            'Wait for camera to stabilize.',
  exposureLow:           'More light needed.',
  glareHigh:             'Reduce glare.',
  tiltHigh:              'Hold phone parallel to road.',
};

// ── Quality thresholds ────────────────────────────────────────

/**
 * All pass/fail thresholds in one place.
 * Replace with a remote-config fetch at app start for live tuning.
 */
export const QUALITY_THRESHOLDS = {
  /** sharpnessScore must be ≥ this */
  sharpnessMin:              0.45,
  /** exposureScore must be in [min, max] */
  exposureMin:               0.30,
  exposureMax:               0.90,
  /** glareScore must be ≥ this (lower = more glare) */
  glareMin:                  0.35,
  /** motionScore must be ≥ this (lower = more motion) */
  motionMin:                 0.62,
  /** tiltScore must be ≥ this (lower = more tilt) */
  tiltMin:                   0.68,
  /** candidateCoverage must be in [min, max] */
  candidateCoverageMin:      0.08,
  candidateCoverageMax:      0.92,
  /** Number of consecutive passing frames required before READY */
  consecutivePassFrames:     5,
  /** Minimum continuous pass window in ms before READY */
  passWindowMs:              700,
  /** Target analysis frequency in Hz */
  analyzerHz:                8,
  /** Auto-capture countdown duration in seconds */
  autoCaptureSecs:           3,
  /** Sharpness rolling window size (frames) */
  sharpnessWindowFrames:     6,
} as const;

// ── Guide geometry ────────────────────────────────────────────

export type GuideGeometry = {
  /** Guide box left edge in px from viewport left */
  x: number;
  /** Guide box top edge in px from viewport top   */
  y: number;
  width: number;
  height: number;
  screenWidth: number;
  screenHeight: number;
};

// ── Persistence ───────────────────────────────────────────────

export type CaptureMetadata = {
  frameQuality:      FrameQuality;
  deviceOrientation: 'portrait' | 'landscape';
  timestamp:         string;          // ISO-8601
  flashUsed:         boolean;
  guideGeometry:     GuideGeometry;
  deviceModel:       string;
  appVersion:        string;
};

export type CaptureRecord = {
  /** Full-resolution, unmodified image URI (file://) */
  imageUri:    string;
  /** Low-resolution JPEG thumbnail URI for quick display */
  thumbnailUri?: string;
  metadata:    CaptureMetadata;
  savedAt:     string;               // ISO-8601
};

// ── Default / sentinel values ─────────────────────────────────

export const DEFAULT_FRAME_QUALITY: FrameQuality = {
  ts:                  0,
  insideBoundary:      false,
  boundaryCoverage:    0,
  sharpnessScore:      0,
  exposureScore:       0,
  glareScore:          0,
  motionScore:         0,
  tiltScore:           0,
  candidatePresent:    false,
  candidateCoverage:   0,
  pass:                false,
  blockingReasons:     [],
};
