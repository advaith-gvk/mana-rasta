/**
 * camera/cameraStore.ts
 * ─────────────────────────────────────────────────────────────
 * Lightweight Zustand bridge between CameraScreen and
 * ReportScreen.  CameraScreen writes here on "Use photo";
 * ReportScreen reads once and immediately clears.
 */

import { create } from 'zustand';
import type { CaptureRecord } from './types';

interface CameraStoreState {
  /** Set by CameraScreen after a successful capture + save. */
  pendingCapture: CaptureRecord | null;

  /** CameraScreen calls this when the user accepts the photo. */
  setPendingCapture: (record: CaptureRecord | null) => void;

  /** ReportScreen calls this after consuming the pending capture. */
  clearPendingCapture: () => void;
}

export const useCameraStore = create<CameraStoreState>(set => ({
  pendingCapture: null,

  setPendingCapture: (record) => set({ pendingCapture: record }),

  clearPendingCapture: () => set({ pendingCapture: null }),
}));
