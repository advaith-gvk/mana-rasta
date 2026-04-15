/**
 * camera/QualityStateMachine.ts
 * ─────────────────────────────────────────────────────────────
 * Deterministic state machine for the PREVIEW → ANALYZING → READY
 * segment of the capture flow.
 *
 * Transition rules
 * ────────────────
 *  PREVIEW   → ANALYZING  on first quality frame received
 *  ANALYZING → READY      when BOTH conditions hold:
 *                           • consecutivePassFrames ≥ CONSECUTIVE_PASS_FRAMES
 *                           • elapsed since first passing frame ≥ PASS_WINDOW_MS
 *  READY     → ANALYZING  if any subsequent frame fails  (quality dropped)
 *  *         → PREVIEW    on explicit reset() call
 *
 * The machine does NOT manage INIT, PERMISSION, CAPTURING,
 * REVIEW, or ERROR — those transitions are owned by the screen.
 */

import { QUALITY_THRESHOLDS, type CaptureState, type FrameQuality } from './types';

const { consecutivePassFrames: PASS_N, passWindowMs: PASS_MS } = QUALITY_THRESHOLDS;

export class QualityStateMachine {
  private state: Extract<CaptureState, 'PREVIEW' | 'ANALYZING' | 'READY'> = 'PREVIEW';

  /** Number of consecutive frames where pass === true */
  private _consecutivePassFrames = 0;

  /** Timestamp of the first frame in the current consecutive-pass streak */
  private _passStreakStart: number | null = null;

  /** Total frames processed since last reset */
  private _totalFrames = 0;

  // ── public API ──────────────────────────────────────────────

  /**
   * Feed one frame's quality report into the machine.
   * Returns the new state so the caller can update UI in the same tick.
   */
  feed(quality: FrameQuality): Extract<CaptureState, 'ANALYZING' | 'READY'> {
    this._totalFrames++;

    if (quality.pass) {
      // Start or extend a consecutive-pass streak
      if (this._passStreakStart === null) {
        this._passStreakStart = quality.ts;
      }
      this._consecutivePassFrames++;

      const elapsedMs = quality.ts - this._passStreakStart;
      const frameGate = this._consecutivePassFrames >= PASS_N;
      const timeGate  = elapsedMs >= PASS_MS;

      if (frameGate && timeGate) {
        this.state = 'READY';
      } else {
        this.state = 'ANALYZING';
      }
    } else {
      // Any failing frame resets the streak
      this._consecutivePassFrames = 0;
      this._passStreakStart = null;
      this.state = 'ANALYZING';
    }

    return this.state;
  }

  /**
   * Reset to PREVIEW state (call before a retake or on camera focus).
   */
  reset(): void {
    this.state                  = 'PREVIEW';
    this._consecutivePassFrames = 0;
    this._passStreakStart       = null;
    this._totalFrames           = 0;
  }

  // ── read-only accessors ─────────────────────────────────────

  getState():                  typeof this.state { return this.state; }
  getConsecutivePassFrames():  number             { return this._consecutivePassFrames; }
  getTotalFrames():            number             { return this._totalFrames; }

  /**
   * Milliseconds elapsed in the current consecutive-pass streak.
   * Returns 0 if no streak is active.
   */
  getPassStreakDurationMs(): number {
    if (this._passStreakStart === null) return 0;
    return Date.now() - this._passStreakStart;
  }

  /**
   * Progress toward the READY gate in [0, 1].
   * Useful for animating the shutter ring fill.
   */
  getReadinessProgress(): number {
    const frameProg = this._consecutivePassFrames / PASS_N;
    const timeProg  = this._passStreakStart !== null
      ? (Date.now() - this._passStreakStart) / PASS_MS
      : 0;
    // Both gates must clear; progress is the minimum of the two
    return Math.min(Math.min(frameProg, timeProg), 1);
  }
}
