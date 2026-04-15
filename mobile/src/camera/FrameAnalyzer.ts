/**
 * camera/FrameAnalyzer.ts
 * ─────────────────────────────────────────────────────────────
 * Runs at QUALITY_THRESHOLDS.analyzerHz (default 8 Hz).
 * Each cycle it reads the latest DeviceMotion snapshot and
 * emits a FrameQuality struct to all registered listeners.
 *
 * REAL metrics  : motion, tilt  (DeviceMotion sensor)
 * DERIVED metric: sharpness     (rolling motion-stability window)
 * STUB metrics  : exposure, glare, candidate, boundary
 *                 → wire in a VisionCamera frame-processor or
 *                   on-device TFLite plugin to make these real.
 *
 * Backpressure: if the previous cycle's callback is still running
 * when the timer fires, the new cycle is skipped to avoid queue
 * build-up on low-end devices.
 */

import { DeviceMotion, type DeviceMotionMeasurement } from 'expo-sensors';
import {
  QUALITY_THRESHOLDS,
  DEFAULT_FRAME_QUALITY,
  type FrameQuality,
  type BlockingReason,
} from './types';

// ── tuneable constants ────────────────────────────────────────
const INTERVAL_MS  = Math.round(1000 / QUALITY_THRESHOLDS.analyzerHz);
const ACCEL_MAX_MS2 = 2.8;   // m/s² magnitude → motionScore = 0
const ROLL_MAX_DEG  = 28;    // degrees of roll → tiltScore = 0

// ── FrameAnalyzer class ───────────────────────────────────────

export class FrameAnalyzer {
  // latest raw sensor data
  private motion: DeviceMotionMeasurement | null = null;

  // rolling motion scores used as a sharpness proxy
  private motionWindow: number[] = [];

  // callbacks
  private readonly listeners = new Set<(q: FrameQuality) => void>();

  // handles
  private sensorSub:   ReturnType<typeof DeviceMotion.addListener> | null = null;
  private timerHandle: ReturnType<typeof setInterval> | null              = null;
  private busy         = false;

  // last known quality (for callers that poll rather than subscribe)
  private latest: FrameQuality = { ...DEFAULT_FRAME_QUALITY };

  // ── lifecycle ───────────────────────────────────────────────

  start(): void {
    if (this.timerHandle !== null) return; // already running

    // Subscribe to DeviceMotion at a slightly higher rate than analysis
    DeviceMotion.setUpdateInterval(Math.round(INTERVAL_MS * 0.7));
    this.sensorSub = DeviceMotion.addListener(data => {
      this.motion = data;
    });

    this.timerHandle = setInterval(() => {
      if (this.busy) return;          // backpressure: skip this cycle
      this.busy = true;
      try {
        const q = this.buildQuality();
        this.latest = q;
        this.listeners.forEach(cb => cb(q));
      } finally {
        this.busy = false;
      }
    }, INTERVAL_MS);
  }

  stop(): void {
    if (this.timerHandle !== null) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
    this.sensorSub?.remove();
    this.sensorSub    = null;
    this.motion       = null;
    this.motionWindow = [];
    this.busy         = false;
  }

  /** Returns the most recent FrameQuality synchronously (useful for initial render). */
  getLatestQuality(): FrameQuality {
    return this.latest;
  }

  /**
   * Register a callback that fires every analysis cycle.
   * Returns an unsubscribe function.
   */
  onQualityUpdate(cb: (q: FrameQuality) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  // ── core analysis ───────────────────────────────────────────

  private buildQuality(): FrameQuality {
    const ts = Date.now();

    // ── Motion score (REAL) ──────────────────────────────────
    // DeviceMotion.acceleration excludes gravity → pure device movement
    const acc = this.motion?.acceleration ?? { x: 0, y: 0, z: 0 };
    const accelMag = Math.sqrt(
      (acc.x ?? 0) ** 2 +
      (acc.y ?? 0) ** 2 +
      (acc.z ?? 0) ** 2,
    );
    // Clamp to [0,1]; lower magnitude = higher score
    const motionScore = Math.max(0, 1 - accelMag / ACCEL_MAX_MS2);

    // ── Tilt score (REAL) ────────────────────────────────────
    // rotation.gamma = left/right roll in degrees (-90…90)
    // We want roll ≈ 0 for a straight-on road shot
    const rollDeg = Math.abs(this.motion?.rotation?.gamma ?? 0);
    const tiltScore = Math.max(0, 1 - rollDeg / ROLL_MAX_DEG);

    // ── Sharpness score (DERIVED) ────────────────────────────
    // Proxy: if the camera has been steady for the last N frames,
    // the probability of motion blur is low.
    this.motionWindow.push(motionScore);
    if (this.motionWindow.length > QUALITY_THRESHOLDS.sharpnessWindowFrames) {
      this.motionWindow.shift();
    }
    const avgMotion = this.motionWindow.reduce((s, v) => s + v, 0) / this.motionWindow.length;
    // Sharpness lags behind motion by one window so it only rises
    // once the camera has been genuinely stable for several frames.
    const sharpnessScore = Math.min(avgMotion * 1.05, 1.0);

    // ── Visual quality stubs ─────────────────────────────────
    // ⚙️  Replace with VisionCamera frame-processor metrics for production.
    const exposureScore      = 0.70;
    const glareScore         = 0.70;
    const candidatePresent   = true;
    const candidateCoverage  = 0.50;
    const insideBoundary     = true;
    const boundaryCoverage   = 0.60;

    // ── Gate evaluation (priority-ordered) ───────────────────
    const blocking: BlockingReason[] = [];

    // 1. Spatial / framing gates
    if (!insideBoundary) {
      blocking.push('outsideBoundary');
    } else if (candidateCoverage < QUALITY_THRESHOLDS.candidateCoverageMin) {
      blocking.push('candidateCoverageLow');
    } else if (candidateCoverage > QUALITY_THRESHOLDS.candidateCoverageMax) {
      blocking.push('candidateCoverageHigh');
    }

    // 2. Sharpness
    if (sharpnessScore < QUALITY_THRESHOLDS.sharpnessMin) {
      blocking.push('sharpnessLow');
    }

    // 3. Motion (separate from sharpness — fast shake vs. slow drift)
    if (motionScore < QUALITY_THRESHOLDS.motionMin) {
      blocking.push('motionHigh');
    }

    // 4. Exposure
    if (
      exposureScore < QUALITY_THRESHOLDS.exposureMin ||
      exposureScore > QUALITY_THRESHOLDS.exposureMax
    ) {
      blocking.push('exposureLow');
    }

    // 5. Glare
    if (glareScore < QUALITY_THRESHOLDS.glareMin) {
      blocking.push('glareHigh');
    }

    // 6. Tilt
    if (tiltScore < QUALITY_THRESHOLDS.tiltMin) {
      blocking.push('tiltHigh');
    }

    return {
      ts,
      insideBoundary,
      boundaryCoverage,
      sharpnessScore,
      exposureScore,
      glareScore,
      motionScore,
      tiltScore,
      candidatePresent,
      candidateCoverage,
      pass:            blocking.length === 0,
      blockingReasons: blocking,
    };
  }
}
