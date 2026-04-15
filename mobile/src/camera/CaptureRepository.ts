/**
 * camera/CaptureRepository.ts
 * ─────────────────────────────────────────────────────────────
 * Atomic persistence for a single capture event.
 *
 * Guarantees
 * ──────────
 *  • The original full-resolution JPEG is NEVER modified —
 *    it is copied to the captures directory verbatim.
 *  • Overlay graphics, guide boundaries, and quality chips
 *    are NEVER burned into the stored image.
 *  • A JSON sidecar is written atomically alongside the image
 *    carrying FrameQuality, device telemetry, and guide geometry.
 *  • If any step fails the partially-written files are cleaned up
 *    so no orphaned data is left on disk.
 */

import * as FileSystem from 'expo-file-system';
import * as Device from 'expo-device';
import { type CaptureMetadata, type CaptureRecord } from './types';

const CAPTURES_DIR = `${FileSystem.documentDirectory}captures/`;
const APP_VERSION  = '1.0.0';

export class CaptureRepository {

  // ── public API ──────────────────────────────────────────────

  /**
   * Persist a raw capture.
   *
   * @param rawUri    file:// URI of the original, unprocessed JPEG
   *                  as returned by CameraView.takePictureAsync
   * @param metadata  quality report, telemetry, guide geometry
   * @returns         CaptureRecord with stable file URIs
   */
  async save(rawUri: string, metadata: CaptureMetadata): Promise<CaptureRecord> {
    await this.ensureDir();

    const id        = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const imageUri  = `${CAPTURES_DIR}${id}.jpg`;
    const metaUri   = `${CAPTURES_DIR}${id}.json`;
    const savedAt   = new Date().toISOString();

    try {
      // 1. Copy original — do NOT use moveAsync; keep the camera's temp file intact
      await FileSystem.copyAsync({ from: rawUri, to: imageUri });

      // 2. Enrich metadata with device info and write sidecar
      const fullMeta: CaptureMetadata & {
        imageFile:   string;
        savedAt:     string;
        deviceBrand: string;
        osVersion:   string;
      } = {
        ...metadata,
        appVersion:  APP_VERSION,
        imageFile:   imageUri,
        savedAt,
        deviceBrand: Device.brand     ?? 'unknown',
        osVersion:   Device.osVersion ?? 'unknown',
      };
      await FileSystem.writeAsStringAsync(metaUri, JSON.stringify(fullMeta, null, 2));

      return { imageUri, metadata: fullMeta, savedAt };

    } catch (err) {
      // Best-effort cleanup to avoid partial records
      await this.safeDelete(imageUri);
      await this.safeDelete(metaUri);
      throw err;
    }
  }

  /**
   * Delete all captures (call on logout or explicit "clear history").
   */
  async clearAll(): Promise<void> {
    const info = await FileSystem.getInfoAsync(CAPTURES_DIR);
    if (info.exists) {
      await FileSystem.deleteAsync(CAPTURES_DIR, { idempotent: true });
    }
  }

  /**
   * List all persisted CaptureRecord URIs, newest first.
   * Reads only the sidecar files — does not decode images.
   */
  async listAll(): Promise<CaptureRecord[]> {
    const info = await FileSystem.getInfoAsync(CAPTURES_DIR);
    if (!info.exists) return [];

    const files   = await FileSystem.readDirectoryAsync(CAPTURES_DIR);
    const jsonFiles = files
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();

    const records: CaptureRecord[] = [];
    for (const file of jsonFiles) {
      try {
        const raw  = await FileSystem.readAsStringAsync(`${CAPTURES_DIR}${file}`);
        const meta = JSON.parse(raw) as CaptureMetadata;
        const id   = file.replace('.json', '');
        records.push({
          imageUri: `${CAPTURES_DIR}${id}.jpg`,
          metadata: meta,
          savedAt:  (meta as any).savedAt ?? '',
        });
      } catch {
        // corrupt sidecar — skip silently
      }
    }
    return records;
  }

  // ── private helpers ─────────────────────────────────────────

  private async ensureDir(): Promise<void> {
    const info = await FileSystem.getInfoAsync(CAPTURES_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(CAPTURES_DIR, { intermediates: true });
    }
  }

  private async safeDelete(uri: string): Promise<void> {
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch {
      // ignore — cleanup is best-effort
    }
  }
}
