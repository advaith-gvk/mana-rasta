/**
 * CameraScreen.tsx
 * ─────────────────────────────────────────────────────────────
 * Gated pothole capture screen.  Implements the deterministic
 * state machine:
 *
 *   INIT → PERMISSION → PREVIEW → ANALYZING ⇄ READY
 *                                            ↓
 *                                        CAPTURING
 *                                            ↓
 *                                         REVIEW
 *                                            ↓
 *                                     (use / retake)
 *
 * Layout zones (top to bottom)
 * ─────────────────────────────
 *   1. Top system bar     ← back, RAW badge, flash toggle
 *   2. Live camera feed   ← full-screen CameraView
 *   3. Guide overlay      ← dimmed mask + boundary box + corner handles
 *   4. Status rail        ← 6 quality chips
 *   5. Bottom action bar  ← prompt label, shutter
 *
 * Dependencies
 * ────────────
 *   expo-camera    ~14.1.2   (CameraView)
 *   expo-sensors             (DeviceMotion — `npx expo install expo-sensors`)
 *   expo-file-system ~16.0.8
 *   expo-device    ~5.9.3
 */

import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Animated, Dimensions, Image, Platform, Pressable,
  SafeAreaView, StatusBar, StyleSheet, Text, View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import * as Device from 'expo-device';

import {
  BLOCKING_PROMPTS, DEFAULT_FRAME_QUALITY, QUALITY_THRESHOLDS,
  type BlockingReason, type CaptureMetadata, type CaptureRecord,
  type CaptureState, type FrameQuality, type GuideGeometry,
} from '../camera/types';
import { FrameAnalyzer }        from '../camera/FrameAnalyzer';
import { QualityStateMachine }  from '../camera/QualityStateMachine';
import { CaptureRepository }    from '../camera/CaptureRepository';
import { useCameraStore }       from '../camera/cameraStore';

// ── brand ─────────────────────────────────────────────────────
const NAVY  = '#002B5C';
const GOLD  = '#F5A623';
const GREEN = '#058541';
const RED   = '#ef4444';
const AMBER = '#f59e0b';

// ── guide box as fraction of screen ───────────────────────────
const { width: SW, height: SH } = Dimensions.get('window');
const GUIDE: GuideGeometry = {
  x:            Math.round(SW * 0.07),
  y:            Math.round(SH * 0.18),
  width:        Math.round(SW * 0.86),
  height:       Math.round(SH * 0.46),
  screenWidth:  SW,
  screenHeight: SH,
};

// ── chip config ───────────────────────────────────────────────
type ChipDef = {
  label:        string;
  scoreKey:     keyof FrameQuality;
  threshold:    number;
  invertLogic?: boolean;   // true → fail when value > threshold
};

const CHIPS: ChipDef[] = [
  { label: 'Frame',    scoreKey: 'insideBoundary',  threshold: 0.5 },
  { label: 'Sharp',    scoreKey: 'sharpnessScore',  threshold: QUALITY_THRESHOLDS.sharpnessMin },
  { label: 'Steady',   scoreKey: 'motionScore',     threshold: QUALITY_THRESHOLDS.motionMin },
  { label: 'Exposure', scoreKey: 'exposureScore',   threshold: QUALITY_THRESHOLDS.exposureMin },
  { label: 'Glare',    scoreKey: 'glareScore',      threshold: QUALITY_THRESHOLDS.glareMin },
  { label: 'Level',    scoreKey: 'tiltScore',       threshold: QUALITY_THRESHOLDS.tiltMin },
];

// ── component ─────────────────────────────────────────────────
export function CameraScreen() {
  const router              = useRouter();
  const { setPendingCapture } = useCameraStore();
  const [permission, requestPermission] = useCameraPermissions();

  // ── state ──────────────────────────────────────────────────
  const [captureState, setCaptureState] = useState<CaptureState>('INIT');
  const [quality,      setQuality]      = useState<FrameQuality>(DEFAULT_FRAME_QUALITY);
  const [flash,        setFlash]        = useState<'on' | 'off'>('off');
  const [capturedUri,  setCapturedUri]  = useState<string | null>(null);
  const [captureRecord, setCaptureRecord] = useState<CaptureRecord | null>(null);
  const [errorMsg,     setErrorMsg]     = useState<string>('');

  // ── refs ───────────────────────────────────────────────────
  const cameraRef   = useRef<CameraView>(null);
  const analyzer    = useRef(new FrameAnalyzer()).current;
  const sm          = useRef(new QualityStateMachine()).current;
  const repo        = useRef(new CaptureRepository()).current;

  // ── animated progress ring fill for shutter ────────────────
  const readinessAnim = useRef(new Animated.Value(0)).current;

  // ── INIT → PERMISSION ─────────────────────────────────────
  useEffect(() => {
    setCaptureState('PERMISSION');
  }, []);

  // ── PERMISSION handling ────────────────────────────────────
  useEffect(() => {
    if (captureState !== 'PERMISSION') return;
    if (permission === null) return;          // still loading

    if (permission.granted) {
      setCaptureState('PREVIEW');
    } else if (permission.canAskAgain) {
      requestPermission();
    } else {
      setErrorMsg('Camera access denied. Enable it in Settings → Privacy → Camera.');
      setCaptureState('ERROR');
    }
  }, [captureState, permission]);

  // ── Analysis pipeline ─────────────────────────────────────
  // Runs whenever camera is visible (PREVIEW → ANALYZING → READY cycle)
  useEffect(() => {
    const isAnalysisState =
      captureState === 'PREVIEW' ||
      captureState === 'ANALYZING' ||
      captureState === 'READY';

    if (!isAnalysisState) return;

    sm.reset();
    analyzer.start();

    const unsub = analyzer.onQualityUpdate(q => {
      setQuality(q);

      // Animate readiness ring
      Animated.timing(readinessAnim, {
        toValue:         sm.getReadinessProgress(),
        duration:        80,
        useNativeDriver: false,
      }).start();

      setCaptureState(prev => {
        if (
          prev === 'CAPTURING' || prev === 'REVIEW' ||
          prev === 'ERROR'     || prev === 'INIT'   ||
          prev === 'PERMISSION'
        ) return prev;
        const advised = sm.feed(q);
        return advised;
      });
    });

    return () => {
      analyzer.stop();
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Re-run only when transitioning into an analysis state from outside it
    captureState === 'PREVIEW' ||
    captureState === 'ANALYZING' ||
    captureState === 'READY',
  ]);

  // ── Capture ────────────────────────────────────────────────
  const handleCapture = useCallback(async () => {
    if (!cameraRef.current) return;
    setCaptureState('CAPTURING');
    analyzer.stop();

    try {
      // Request the highest-quality, unprocessed frame
      const photo = await cameraRef.current.takePictureAsync({
        quality:         1.0,
        exif:            true,
        skipProcessing:  true,   // Android: skip processing pipeline
      });

      const metadata: CaptureMetadata = {
        frameQuality:      quality,
        deviceOrientation: 'portrait',
        timestamp:         new Date().toISOString(),
        flashUsed:         flash === 'on',
        guideGeometry:     GUIDE,
        deviceModel:       `${Device.brand ?? ''} ${Device.modelName ?? ''}`.trim(),
        appVersion:        '1.0.0',
      };

      const record = await repo.save(photo.uri, metadata);
      setCapturedUri(record.imageUri);
      setCaptureRecord(record);
      setCaptureState('REVIEW');

    } catch (err) {
      setErrorMsg('Capture failed. Please try again.');
      setCaptureState('ERROR');
    }
  }, [quality, flash, analyzer, repo]);

  // ── Retake ─────────────────────────────────────────────────
  const handleRetake = useCallback(() => {
    setCapturedUri(null);
    setCaptureRecord(null);
    readinessAnim.setValue(0);
    setCaptureState('PREVIEW');
  }, [readinessAnim]);

  // ── Accept ─────────────────────────────────────────────────
  const handleUse = useCallback(() => {
    if (!captureRecord) return;
    setPendingCapture(captureRecord);
    router.back();
  }, [captureRecord, setPendingCapture, router]);

  // ── Primary prompt text ────────────────────────────────────
  const promptText = useMemo(() => {
    if (captureState === 'PREVIEW')   return 'Align pothole inside the boundary.';
    if (captureState === 'READY')     return 'Image ready.';
    if (captureState === 'CAPTURING') return 'Capturing…';
    if (quality.blockingReasons.length > 0) {
      return BLOCKING_PROMPTS[quality.blockingReasons[0] as BlockingReason];
    }
    return 'Analyzing…';
  }, [captureState, quality.blockingReasons]);

  // ── render: gating screens ─────────────────────────────────
  if (captureState === 'PERMISSION') {
    return (
      <SafeAreaView style={styles.gateScreen}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <Text style={styles.gateIcon}>📷</Text>
        <Text style={styles.gateTitle}>Camera access needed</Text>
        <Text style={styles.gateSub}>
          Mana Rasta needs the camera to photograph the pothole. No image leaves your device until you submit a report.
        </Text>
        <Pressable style={styles.gateBtn} onPress={() => requestPermission()}>
          <Text style={styles.gateBtnText}>Allow camera access</Text>
        </Pressable>
        <Pressable style={styles.gateLinkBtn} onPress={() => router.back()}>
          <Text style={styles.gateLinkText}>Cancel</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (captureState === 'ERROR') {
    return (
      <SafeAreaView style={styles.gateScreen}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <Text style={styles.gateIcon}>⚠️</Text>
        <Text style={styles.gateTitle}>Camera unavailable</Text>
        <Text style={styles.gateSub}>{errorMsg}</Text>
        <Pressable style={styles.gateBtn} onPress={() => router.back()}>
          <Text style={styles.gateBtnText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (captureState === 'REVIEW' && capturedUri) {
    return (
      <ReviewPane
        uri={capturedUri}
        quality={quality}
        onRetake={handleRetake}
        onUse={handleUse}
      />
    );
  }

  // ── render: main camera view ───────────────────────────────
  const shutterReady = captureState === 'READY';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Zone 2: Camera feed ── */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        flash={flash}
        // Disable all post-processing effects
        // (expo-camera v14 does not expose beauty/HDR props)
      />

      {/* ── Zone 3: Guide overlay ── */}
      <GuideOverlay geometry={GUIDE} active={captureState !== 'CAPTURING'} />

      {/* ── Zone 1: Top bar ── */}
      <SafeAreaView style={styles.topBarSafe}>
        <View style={styles.topBar}>
          <Pressable
            style={styles.topBarBtn}
            onPress={() => router.back()}
            hitSlop={12}
          >
            <Text style={styles.topBarIcon}>←</Text>
          </Pressable>

          <View style={styles.rawBadge}>
            <Text style={styles.rawBadgeText}>RAW</Text>
          </View>

          <Pressable
            style={styles.topBarBtn}
            onPress={() => setFlash(f => f === 'off' ? 'on' : 'off')}
            hitSlop={12}
          >
            <Text style={styles.topBarIcon}>{flash === 'on' ? '⚡' : '🔦'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {/* ── Zone 4: Status rail ── */}
      <View style={styles.statusRail}>
        {CHIPS.map(chip => (
          <QualityChip key={chip.label} chip={chip} quality={quality} state={captureState} />
        ))}
      </View>

      {/* ── Zone 5: Bottom action bar ── */}
      <View style={styles.bottomBar}>
        {/* Prompt */}
        <Text
          style={[
            styles.promptText,
            captureState === 'READY'
              ? styles.promptTextReady
              : quality.blockingReasons.length > 0
                ? styles.promptTextWarn
                : styles.promptTextNeutral,
          ]}
          numberOfLines={1}
        >
          {promptText}
        </Text>

        {/* Shutter */}
        <Pressable
          style={[styles.shutter, shutterReady && styles.shutterReady]}
          onPress={shutterReady ? handleCapture : undefined}
          disabled={!shutterReady && captureState !== 'ANALYZING'}
        >
          {/* Animated readiness ring */}
          <Animated.View
            style={[
              styles.shutterRing,
              {
                borderColor: readinessAnim.interpolate({
                  inputRange:  [0, 1],
                  outputRange: ['rgba(255,255,255,0.2)', GOLD],
                }),
              },
            ]}
          />
          <View
            style={[
              styles.shutterInner,
              shutterReady && styles.shutterInnerReady,
            ]}
          />
        </Pressable>

        <Text style={styles.shutterHint}>
          {shutterReady ? 'Tap to capture' : 'Hold steady…'}
        </Text>
      </View>
    </View>
  );
}

// ── Sub-component: GuideOverlay ───────────────────────────────

function GuideOverlay({
  geometry: g,
  active,
}: {
  geometry: GuideGeometry;
  active:   boolean;
}) {
  const opacity = active ? 0.60 : 0;
  const MASK    = `rgba(0,0,0,${opacity})`;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Top strip */}
      <View style={[styles.maskStrip, { top: 0, left: 0, right: 0, height: g.y, backgroundColor: MASK }]} />
      {/* Bottom strip */}
      <View style={[styles.maskStrip, {
        top:             g.y + g.height,
        left:            0,
        right:           0,
        bottom:          0,
        backgroundColor: MASK,
      }]} />
      {/* Left strip */}
      <View style={[styles.maskStrip, {
        top:             g.y,
        left:            0,
        width:           g.x,
        height:          g.height,
        backgroundColor: MASK,
      }]} />
      {/* Right strip */}
      <View style={[styles.maskStrip, {
        top:             g.y,
        left:            g.x + g.width,
        right:           0,
        height:          g.height,
        backgroundColor: MASK,
      }]} />

      {/* Guide box border */}
      <View style={[styles.guideBorder, {
        left:   g.x,
        top:    g.y,
        width:  g.width,
        height: g.height,
      }]} />

      {/* Corner handles */}
      <CornerHandles g={g} />
    </View>
  );
}

function CornerHandles({ g }: { g: GuideGeometry }) {
  const H   = 22;
  const W   = 22;
  const T   = 3;
  const COL = GOLD;

  return (
    <>
      {/* Top-left */}
      <View style={[styles.cornerH, { left: g.x, top: g.y, width: W, height: T, backgroundColor: COL }]} />
      <View style={[styles.cornerV, { left: g.x, top: g.y, width: T, height: H, backgroundColor: COL }]} />
      {/* Top-right */}
      <View style={[styles.cornerH, { left: g.x + g.width - W, top: g.y, width: W, height: T, backgroundColor: COL }]} />
      <View style={[styles.cornerV, { left: g.x + g.width - T, top: g.y, width: T, height: H, backgroundColor: COL }]} />
      {/* Bottom-left */}
      <View style={[styles.cornerH, { left: g.x, top: g.y + g.height - T, width: W, height: T, backgroundColor: COL }]} />
      <View style={[styles.cornerV, { left: g.x, top: g.y + g.height - H, width: T, height: H, backgroundColor: COL }]} />
      {/* Bottom-right */}
      <View style={[styles.cornerH, { left: g.x + g.width - W, top: g.y + g.height - T, width: W, height: T, backgroundColor: COL }]} />
      <View style={[styles.cornerV, { left: g.x + g.width - T, top: g.y + g.height - H, width: T, height: H, backgroundColor: COL }]} />
    </>
  );
}

// ── Sub-component: QualityChip ────────────────────────────────

function QualityChip({
  chip,
  quality,
  state,
}: {
  chip:    ChipDef;
  quality: FrameQuality;
  state:   CaptureState;
}) {
  const raw = quality[chip.scoreKey];
  const val = typeof raw === 'boolean' ? (raw ? 1 : 0) : (raw as number);

  const passing = chip.invertLogic
    ? val <= chip.threshold
    : val >= chip.threshold;

  const isAnalyzing = state === 'PREVIEW' || state === 'ANALYZING' || state === 'READY';

  const dotColor = !isAnalyzing
    ? '#6b7280'
    : passing
      ? GREEN
      : val > chip.threshold * 0.6
        ? AMBER
        : RED;

  return (
    <View style={[styles.chip, !passing && isAnalyzing && styles.chipFail]}>
      <View style={[styles.chipDot, { backgroundColor: dotColor }]} />
      <Text style={[styles.chipText, !passing && isAnalyzing && styles.chipTextFail]}>
        {chip.label}
      </Text>
    </View>
  );
}

// ── Sub-component: ReviewPane ─────────────────────────────────

function ReviewPane({
  uri,
  quality,
  onRetake,
  onUse,
}: {
  uri:      string;
  quality:  FrameQuality;
  onRetake: () => void;
  onUse:    () => void;
}) {
  return (
    <View style={styles.reviewContainer}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Image */}
      <Image source={{ uri }} style={styles.reviewImage} resizeMode="cover" />

      {/* Quality summary overlay */}
      <View style={styles.reviewOverlay}>
        <View style={styles.reviewHeader}>
          <View style={styles.reviewQualityBadge}>
            <Text style={styles.reviewQualityIcon}>{quality.pass ? '✓' : '!'}</Text>
            <Text style={styles.reviewQualityText}>
              {quality.pass ? 'Quality OK' : 'Low quality'}
            </Text>
          </View>
        </View>

        {/* Metric summary pills */}
        <View style={styles.reviewMetrics}>
          <MetricPill
            label="Motion"
            score={quality.motionScore}
            min={QUALITY_THRESHOLDS.motionMin}
          />
          <MetricPill
            label="Tilt"
            score={quality.tiltScore}
            min={QUALITY_THRESHOLDS.tiltMin}
          />
          <MetricPill
            label="Sharp"
            score={quality.sharpnessScore}
            min={QUALITY_THRESHOLDS.sharpnessMin}
          />
        </View>

        {/* CTA buttons */}
        <View style={styles.reviewActions}>
          <Pressable style={styles.retakeBtn} onPress={onRetake}>
            <Text style={styles.retakeBtnText}>↩  Retake</Text>
          </Pressable>
          <Pressable style={styles.useBtn} onPress={onUse}>
            <Text style={styles.useBtnText}>Use photo  →</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function MetricPill({ label, score, min }: { label: string; score: number; min: number }) {
  const pass = score >= min;
  return (
    <View style={[styles.metricPill, pass ? styles.metricPillPass : styles.metricPillFail]}>
      <Text style={styles.metricPillText}>
        {pass ? '✓' : '✗'} {label}
      </Text>
    </View>
  );
}

// ── styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // main camera view
  container:            { flex: 1, backgroundColor: '#000' },

  // permission / error gate screens
  gateScreen:           { flex: 1, backgroundColor: NAVY, alignItems: 'center',
                          justifyContent: 'center', paddingHorizontal: 32 },
  gateIcon:             { fontSize: 56, marginBottom: 16 },
  gateTitle:            { color: '#fff', fontSize: 20, fontWeight: '700',
                          textAlign: 'center', marginBottom: 12 },
  gateSub:              { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center',
                          lineHeight: 20, marginBottom: 32 },
  gateBtn:              { backgroundColor: GOLD, borderRadius: 14, paddingVertical: 16,
                          paddingHorizontal: 40, marginBottom: 12 },
  gateBtnText:          { color: NAVY, fontSize: 16, fontWeight: '700' },
  gateLinkBtn:          { paddingVertical: 10 },
  gateLinkText:         { color: 'rgba(255,255,255,0.5)', fontSize: 14 },

  // top bar
  topBarSafe:           { position: 'absolute', top: 0, left: 0, right: 0 },
  topBar:               { flexDirection: 'row', justifyContent: 'space-between',
                          alignItems: 'center', paddingHorizontal: 16,
                          paddingTop: Platform.OS === 'android' ? 32 : 8,
                          paddingBottom: 8 },
  topBarBtn:            { width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
                          backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20 },
  topBarIcon:           { color: '#fff', fontSize: 18 },
  rawBadge:             { backgroundColor: 'rgba(0,43,92,0.75)', borderRadius: 6,
                          paddingHorizontal: 10, paddingVertical: 4,
                          borderWidth: 1, borderColor: GOLD },
  rawBadgeText:         { color: GOLD, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },

  // guide overlay helpers
  maskStrip:            { position: 'absolute' },
  guideBorder:          { position: 'absolute', borderWidth: 1.5,
                          borderColor: 'rgba(255,255,255,0.55)', borderRadius: 4 },
  cornerH:              { position: 'absolute' },
  cornerV:              { position: 'absolute' },

  // status rail
  statusRail:           { position: 'absolute',
                          bottom: 160,
                          left:   0,
                          right:  0,
                          flexDirection:  'row',
                          justifyContent: 'center',
                          flexWrap: 'wrap',
                          gap: 6,
                          paddingHorizontal: 16 },
  chip:                 { flexDirection: 'row', alignItems: 'center', gap: 5,
                          backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20,
                          paddingHorizontal: 10, paddingVertical: 5,
                          borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  chipFail:             { borderColor: RED + '88' },
  chipDot:              { width: 7, height: 7, borderRadius: 4 },
  chipText:             { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '500' },
  chipTextFail:         { color: '#fca5a5' },

  // bottom action bar
  bottomBar:            { position: 'absolute', bottom: 0, left: 0, right: 0,
                          alignItems: 'center', paddingBottom: Platform.OS === 'ios' ? 40 : 28,
                          paddingTop: 16, backgroundColor: 'rgba(0,0,0,0.5)' },
  promptText:           { fontSize: 14, fontWeight: '600', marginBottom: 16, letterSpacing: 0.3 },
  promptTextReady:      { color: GOLD },
  promptTextWarn:       { color: '#fbbf24' },
  promptTextNeutral:    { color: 'rgba(255,255,255,0.6)' },

  // shutter button
  shutter:              { width: 76, height: 76, borderRadius: 38,
                          alignItems: 'center', justifyContent: 'center',
                          marginBottom: 8 },
  shutterRing:          { position: 'absolute', width: 76, height: 76, borderRadius: 38,
                          borderWidth: 3 },
  shutterInner:         { width: 60, height: 60, borderRadius: 30,
                          backgroundColor: 'rgba(255,255,255,0.25)' },
  shutterInnerReady:    { backgroundColor: GOLD,
                          shadowColor: GOLD, shadowOpacity: 0.7,
                          shadowRadius: 16, shadowOffset: { width: 0, height: 0 },
                          elevation: 8 },
  shutterReady:         {},
  shutterHint:          { color: 'rgba(255,255,255,0.4)', fontSize: 11 },

  // review pane
  reviewContainer:      { flex: 1, backgroundColor: '#000' },
  reviewImage:          { ...StyleSheet.absoluteFillObject },
  reviewOverlay:        { position: 'absolute', bottom: 0, left: 0, right: 0,
                          backgroundColor: 'rgba(0,0,0,0.72)',
                          paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 44 : 28,
                          paddingTop: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  reviewHeader:         { flexDirection: 'row', justifyContent: 'center', marginBottom: 14 },
  reviewQualityBadge:   { flexDirection: 'row', alignItems: 'center', gap: 6,
                          backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20,
                          paddingHorizontal: 14, paddingVertical: 6 },
  reviewQualityIcon:    { color: '#fff', fontSize: 14, fontWeight: '700' },
  reviewQualityText:    { color: '#fff', fontSize: 13, fontWeight: '600' },
  reviewMetrics:        { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
  metricPill:           { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5 },
  metricPillPass:       { backgroundColor: 'rgba(5,133,65,0.55)' },
  metricPillFail:       { backgroundColor: 'rgba(239,68,68,0.55)' },
  metricPillText:       { color: '#fff', fontSize: 12, fontWeight: '600' },
  reviewActions:        { flexDirection: 'row', gap: 12 },
  retakeBtn:            { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)',
                          borderRadius: 14, paddingVertical: 16, alignItems: 'center',
                          borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  retakeBtnText:        { color: '#fff', fontSize: 15, fontWeight: '600' },
  useBtn:               { flex: 1.6, backgroundColor: GOLD, borderRadius: 14,
                          paddingVertical: 16, alignItems: 'center',
                          shadowColor: GOLD, shadowOpacity: 0.4,
                          shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  useBtnText:           { color: NAVY, fontSize: 15, fontWeight: '800' },
});
