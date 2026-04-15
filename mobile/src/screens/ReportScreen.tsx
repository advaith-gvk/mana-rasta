/**
 * ReportScreen — progressive-disclosure pothole reporting
 * Brand: GHMC Navy #002B5C | Heritage Gold #F5A623 | tricolour stripe
 *
 * Flow
 * ────
 *   PHOTO   → camera only; gated CameraScreen (no gallery option)
 *   DETAILS → location auto-fetches in background immediately after
 *             photo arrives; map + ward tag; road type; notes;
 *             "Confirm location" button
 *   SEVERITY→ appears after location confirmed; severity selector;
 *             submit button
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator, Image, Platform,
  SafeAreaView, StatusBar, Animated,
} from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { useRouter, useFocusEffect } from 'expo-router';
import { mobileApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useCameraStore } from '../camera/cameraStore';

// ── brand ────────────────────────────────────────────────────
const NAVY  = '#002B5C';
const GOLD  = '#F5A623';
const GREEN = '#058541';

// ── types ─────────────────────────────────────────────────────
type Phase    = 'photo' | 'details' | 'severity';
type Severity = 'low' | 'medium' | 'high' | 'critical';
type RoadType = 'local' | 'main_road' | 'highway';

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; emoji: string; sla: string }> = {
  low:      { label: 'Low',      color: '#22c55e', emoji: '🟢', sla: '7 days' },
  medium:   { label: 'Medium',   color: '#f59e0b', emoji: '🟡', sla: '96 hrs' },
  high:     { label: 'High',     color: '#f97316', emoji: '🟠', sla: '48 hrs' },
  critical: { label: 'Critical', color: '#ef4444', emoji: '🔴', sla: '24 hrs' },
};

const ROAD_TYPES: { value: RoadType; label: string; icon: string }[] = [
  { value: 'local',     label: 'Local',      icon: '🏘' },
  { value: 'main_road', label: 'Main Road',  icon: '🛣' },
  { value: 'highway',   label: 'Highway',    icon: '🛤' },
];

// ── fade-in helper ─────────────────────────────────────────────
function FadeIn({ children, visible }: { children: React.ReactNode; visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue:         visible ? 1 : 0,
      duration:        320,
      useNativeDriver: true,
    }).start();
  }, [visible]);
  if (!visible) return null;
  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

// ── component ─────────────────────────────────────────────────
export function ReportScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuthStore();
  const { pendingCapture, clearPendingCapture } = useCameraStore();

  // ── state ──────────────────────────────────────────────────
  const [phase,        setPhase]        = useState<Phase>('photo');
  const [image,        setImage]        = useState<{ uri: string } | null>(null);
  const [location,     setLocation]     = useState<{ lat: number; lng: number } | null>(null);
  const [geoInfo,      setGeoInfo]      = useState<any>(null);
  const [locLoading,   setLocLoading]   = useState(false);
  const [locError,     setLocError]     = useState(false);
  const [locConfirmed, setLocConfirmed] = useState(false);
  const [severity,     setSeverity]     = useState<Severity>('medium');
  const [roadType,     setRoadType]     = useState<RoadType>('local');
  const [description,  setDescription]  = useState('');
  const [submitting,   setSubmitting]   = useState(false);

  // ── consume image from CameraScreen ───────────────────────
  useFocusEffect(
    useCallback(() => {
      if (pendingCapture) {
        setImage({ uri: pendingCapture.imageUri });
        clearPendingCapture();
        // Advance to details — location fetch begins automatically below
        setPhase('details');
        setLocConfirmed(false);
        setLocation(null);
        setGeoInfo(null);
      }
    }, [pendingCapture, clearPendingCapture]),
  );

  // ── auto-fetch location when DETAILS phase starts ──────────
  useEffect(() => {
    if (phase === 'details') {
      fetchLocation();
    }
  }, [phase]);

  const fetchLocation = useCallback(async () => {
    setLocLoading(true);
    setLocError(false);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocError(true);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude: lat, longitude: lng } = loc.coords;
      setLocation({ lat, lng });
      try {
        const geo = await mobileApi.resolveLocation(lat, lng);
        setGeoInfo(geo);
      } catch {
        // geo resolve is best-effort
      }
    } catch {
      setLocError(true);
    } finally {
      setLocLoading(false);
    }
  }, []);

  // ── confirm location → advance to severity ─────────────────
  const confirmLocation = useCallback(() => {
    if (!location) return;
    if (geoInfo?.is_outside_ghmc) {
      Alert.alert(
        'Outside GHMC limits',
        'This location is outside GHMC limits and cannot be reported here.',
      );
      return;
    }
    setLocConfirmed(true);
    setPhase('severity');
  }, [location, geoInfo]);

  // ── retake photo → back to start ──────────────────────────
  const handleRetakePhoto = useCallback(() => {
    setImage(null);
    setLocation(null);
    setGeoInfo(null);
    setLocConfirmed(false);
    setPhase('photo');
  }, []);

  // ── submit ─────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!image || !location) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('image',     { uri: image.uri, name: 'pothole.jpg', type: 'image/jpeg' } as any);
      formData.append('latitude',  String(location.lat));
      formData.append('longitude', String(location.lng));
      formData.append('severity',  severity);
      formData.append('roadType',  roadType);
      if (description.trim()) formData.append('description', description.trim());

      const result = await mobileApi.submitReport(formData);
      updateUser({ total_reports: (user?.total_reports || 0) + 1 });

      router.push({
        pathname: '/report/success',
        params: {
          reportId: result.reportId,
          wardName: geoInfo?.ward_name || '',
          zoneName: geoInfo?.zone_name || '',
          points:   '20',
        },
      });
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Submission failed. Please try again.';
      Alert.alert('Submission error', msg);
    } finally {
      setSubmitting(false);
    }
  }, [image, location, geoInfo, severity, roadType, description, user, updateUser, router]);

  // ── render ─────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report a Pothole</Text>
        {/* Step indicator */}
        <View style={styles.stepRow}>
          {(['photo','details','severity'] as Phase[]).map((p, i) => (
            <View key={p} style={[styles.stepDot, phase === p && styles.stepDotActive,
              (phase === 'details' && i === 0) || (phase === 'severity' && i < 2)
                ? styles.stepDotDone : null]} />
          ))}
        </View>
      </View>

      {/* Tricolour stripe */}
      <View style={styles.tricolour}>
        {['#FF9933', '#FFFFFF', GREEN].map(c => (
          <View key={c} style={[styles.stripe, { backgroundColor: c }]} />
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Reward banner — always visible */}
        <View style={styles.rewardBanner}>
          <Text style={styles.rewardStar}>🌟</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.rewardTitle}>Earn 20 points</Text>
            <Text style={styles.rewardSub}>for every verified pothole report</Text>
          </View>
          <View style={styles.rewardBadge}>
            <Text style={styles.rewardBadgeNum}>+20</Text>
            <Text style={styles.rewardBadgePts}>pts</Text>
          </View>
        </View>

        {/* ── STEP 1: Photo ───────────────────────────────── */}
        <Text style={styles.sectionLabel}>
          Photo <Text style={styles.required}>*</Text>
        </Text>

        {image ? (
          <View style={styles.imagePreview}>
            <Image source={{ uri: image.uri }} style={styles.previewImg} resizeMode="cover" />
            {/* Only allow retake if not yet confirmed location */}
            {!locConfirmed && (
              <TouchableOpacity style={styles.retakeBtn} onPress={handleRetakePhoto}>
                <Text style={styles.retakeBtnText}>✕  Retake</Text>
              </TouchableOpacity>
            )}
            {/* Confirmed lock badge */}
            {locConfirmed && (
              <View style={styles.lockedBadge}>
                <Text style={styles.lockedBadgeText}>📷 Photo locked</Text>
              </View>
            )}
          </View>
        ) : (
          /* Full-width single camera button */
          <TouchableOpacity
            style={styles.cameraBtnFull}
            onPress={() => router.push('/camera')}
            activeOpacity={0.85}
          >
            <Text style={styles.cameraBtnIcon}>📷</Text>
            <Text style={styles.cameraBtnPrimary}>Take photo</Text>
            <Text style={styles.cameraBtnSub}>Better photos = faster repairs</Text>
          </TouchableOpacity>
        )}

        {/* ── STEP 2: Location + Road type + Notes ────────── */}
        <FadeIn visible={phase === 'details' || phase === 'severity'}>

          <View style={styles.sectionDivider}>
            <View style={styles.sectionDividerLine} />
            <Text style={styles.sectionDividerText}>Auto-detected location</Text>
            <View style={styles.sectionDividerLine} />
          </View>

          {locLoading ? (
            <View style={styles.locLoader}>
              <ActivityIndicator color={GOLD} size="small" />
              <Text style={styles.locLoaderText}>Fetching your location from GPS…</Text>
            </View>
          ) : locError ? (
            <TouchableOpacity style={styles.locError} onPress={fetchLocation} activeOpacity={0.85}>
              <Text style={styles.locErrorIcon}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.locErrorPrimary}>Location unavailable</Text>
                <Text style={styles.locErrorSub}>Tap to retry GPS</Text>
              </View>
            </TouchableOpacity>
          ) : location ? (
            <View style={styles.mapCard}>
              <MapView
                style={styles.map}
                initialRegion={{
                  latitude:       location.lat,
                  longitude:      location.lng,
                  latitudeDelta:  0.003,
                  longitudeDelta: 0.003,
                }}
                // Map is read-only — location comes from device GPS
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
              >
                <Marker
                  coordinate={{ latitude: location.lat, longitude: location.lng }}
                  pinColor="#f97316"
                />
              </MapView>

              {geoInfo?.ward_name && !geoInfo?.is_outside_ghmc && (
                <View style={styles.wardTag}>
                  <Text style={styles.wardTagText}>
                    📍 {geoInfo.ward_name} Ward · {geoInfo.zone_name} Zone
                  </Text>
                  <Text style={styles.wardTagCoords}>
                    {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                  </Text>
                </View>
              )}

              {geoInfo?.is_outside_ghmc && (
                <View style={styles.warningTag}>
                  <Text style={styles.warningTagText}>⚠️ Outside GHMC boundary</Text>
                </View>
              )}

              {/* Confirm button — only when not yet confirmed */}
              {!locConfirmed && (
                <TouchableOpacity
                  style={[styles.confirmLocBtn,
                    geoInfo?.is_outside_ghmc && styles.confirmLocBtnDisabled]}
                  onPress={confirmLocation}
                  disabled={!!geoInfo?.is_outside_ghmc}
                  activeOpacity={0.85}
                >
                  <Text style={styles.confirmLocBtnText}>✓  Confirm this location</Text>
                </TouchableOpacity>
              )}

              {locConfirmed && (
                <View style={styles.locConfirmedTag}>
                  <Text style={styles.locConfirmedText}>✓ Location confirmed</Text>
                </View>
              )}
            </View>
          ) : null}

          {/* Road type */}
          <Text style={styles.sectionLabel}>Road type</Text>
          <View style={styles.roadTypeRow}>
            {ROAD_TYPES.map(r => (
              <TouchableOpacity
                key={r.value}
                style={[styles.roadChip, roadType === r.value && styles.roadChipActive]}
                onPress={() => setRoadType(r.value)}
                activeOpacity={0.7}
              >
                <Text style={styles.roadChipIcon}>{r.icon}</Text>
                <Text style={[styles.roadChipText, roadType === r.value && styles.roadChipTextActive]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Notes */}
          <Text style={styles.sectionLabel}>Additional notes (optional)</Text>
          <TextInput
            style={styles.textarea}
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. Near Sarojini Devi hospital, water-filled crater blocking traffic…"
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{description.length} / 500</Text>

        </FadeIn>

        {/* ── STEP 3: Severity + Submit ────────────────────── */}
        <FadeIn visible={phase === 'severity'}>

          <View style={styles.sectionDivider}>
            <View style={styles.sectionDividerLine} />
            <Text style={styles.sectionDividerText}>How severe is it?</Text>
            <View style={styles.sectionDividerLine} />
          </View>

          <View style={styles.severityRow}>
            {(Object.entries(SEVERITY_CONFIG) as [Severity, typeof SEVERITY_CONFIG[Severity]][]).map(([s, cfg]) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.severityBtn,
                  severity === s && { borderColor: cfg.color, backgroundColor: cfg.color + '18' },
                ]}
                onPress={() => setSeverity(s)}
                activeOpacity={0.7}
              >
                <Text style={styles.severityEmoji}>{cfg.emoji}</Text>
                <Text style={[styles.severityLabel,
                  severity === s && { color: cfg.color, fontWeight: '700' }]}>
                  {cfg.label}
                </Text>
                <Text style={[styles.severitySla, severity === s && { color: cfg.color }]}>
                  {cfg.sla}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={NAVY} />
            ) : (
              <>
                <Text style={styles.submitBtnText}>Submit Report</Text>
                <View style={styles.submitPtsTag}>
                  <Text style={styles.submitPtsText}>+20 pts</Text>
                </View>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Sent directly to Ward AE/DEE via GHMC IGS:{'\n'}
            Engineering → Repairs to Road (Pot Holes)
          </Text>

        </FadeIn>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: NAVY },
  scroll:         { flex: 1, backgroundColor: '#F8F9FA' },
  scrollContent:  { padding: 20, paddingBottom: 56 },

  // header
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingHorizontal: 16,
                    paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 14,
                    backgroundColor: NAVY },
  backBtn:        { width: 40, height: 40, justifyContent: 'center' },
  backArrow:      { color: '#fff', fontSize: 22, fontWeight: '300' },
  headerTitle:    { color: '#fff', fontSize: 17, fontWeight: '700' },
  stepRow:        { flexDirection: 'row', gap: 5, alignItems: 'center' },
  stepDot:        { width: 7, height: 7, borderRadius: 4,
                    backgroundColor: 'rgba(255,255,255,0.25)' },
  stepDotActive:  { backgroundColor: GOLD, width: 16 },
  stepDotDone:    { backgroundColor: 'rgba(255,255,255,0.55)' },

  // tricolour
  tricolour:      { flexDirection: 'row', height: 9 },
  stripe:         { flex: 1 },

  // reward banner
  rewardBanner:   { flexDirection: 'row', alignItems: 'center', gap: 12,
                    backgroundColor: '#FFF8E7', borderWidth: 1.5, borderColor: GOLD,
                    borderRadius: 14, padding: 14, marginBottom: 4 },
  rewardStar:     { fontSize: 26 },
  rewardTitle:    { fontSize: 14, fontWeight: '700', color: '#92400e' },
  rewardSub:      { fontSize: 12, color: '#b45309', marginTop: 1 },
  rewardBadge:    { backgroundColor: GOLD, borderRadius: 10, paddingHorizontal: 10,
                    paddingVertical: 6, alignItems: 'center' },
  rewardBadgeNum: { fontSize: 18, fontWeight: '800', color: NAVY },
  rewardBadgePts: { fontSize: 9, fontWeight: '700', color: NAVY, letterSpacing: 0.5 },

  // labels
  sectionLabel:   { fontSize: 11, fontWeight: '700', color: NAVY, marginBottom: 10, marginTop: 20,
                    textTransform: 'uppercase', letterSpacing: 0.8 },
  required:       { color: '#ef4444' },

  // photo
  cameraBtnFull:  { borderWidth: 2, borderColor: '#f97316', borderRadius: 18, borderStyle: 'dashed',
                    paddingVertical: 36, alignItems: 'center', backgroundColor: '#fff7ed', gap: 6 },
  cameraBtnIcon:  { fontSize: 36 },
  cameraBtnPrimary:{ fontSize: 16, fontWeight: '700', color: '#374151' },
  cameraBtnSub:   { fontSize: 12, color: '#9ca3af' },
  imagePreview:   { borderRadius: 16, overflow: 'hidden', position: 'relative' },
  previewImg:     { width: '100%', height: 210, borderRadius: 16 },
  retakeBtn:      { position: 'absolute', bottom: 10, right: 10,
                    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 8,
                    paddingHorizontal: 12, paddingVertical: 6 },
  retakeBtnText:  { color: '#fff', fontSize: 12, fontWeight: '600' },
  lockedBadge:    { position: 'absolute', bottom: 10, right: 10,
                    backgroundColor: 'rgba(5,133,65,0.85)', borderRadius: 8,
                    paddingHorizontal: 10, paddingVertical: 5 },
  lockedBadgeText:{ color: '#fff', fontSize: 11, fontWeight: '600' },

  // section divider
  sectionDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24, marginBottom: 4 },
  sectionDividerLine:{ flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  sectionDividerText:{ fontSize: 11, color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase',
                       letterSpacing: 0.6 },

  // location
  locLoader:      { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 18,
                    backgroundColor: '#f9fafb', borderRadius: 14,
                    borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 4 },
  locLoaderText:  { color: '#6b7280', fontSize: 13 },
  locError:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16,
                    backgroundColor: '#fff7ed', borderRadius: 14,
                    borderWidth: 1.5, borderColor: GOLD },
  locErrorIcon:   { fontSize: 24 },
  locErrorPrimary:{ fontSize: 13, fontWeight: '600', color: '#92400e' },
  locErrorSub:    { fontSize: 11, color: '#b45309', marginTop: 1 },
  mapCard:        { gap: 8 },
  map:            { height: 180, borderRadius: 14 },
  wardTag:        { backgroundColor: '#ecfdf5', borderRadius: 10, padding: 10,
                    borderWidth: 1, borderColor: '#6ee7b7' },
  wardTagText:    { fontSize: 13, color: '#065f46', fontWeight: '600' },
  wardTagCoords:  { fontSize: 10, color: '#6b7280', marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  warningTag:     { backgroundColor: '#fefce8', borderRadius: 10, padding: 10,
                    borderWidth: 1, borderColor: '#fde047' },
  warningTagText: { fontSize: 12, color: '#92400e', fontWeight: '600' },
  confirmLocBtn:  { backgroundColor: NAVY, borderRadius: 12, paddingVertical: 14,
                    alignItems: 'center', marginTop: 4 },
  confirmLocBtnDisabled:{ opacity: 0.4 },
  confirmLocBtnText:    { color: '#fff', fontSize: 14, fontWeight: '700' },
  locConfirmedTag:{ backgroundColor: '#ecfdf5', borderRadius: 10, padding: 10,
                    borderWidth: 1, borderColor: '#6ee7b7', alignItems: 'center', marginTop: 4 },
  locConfirmedText:{ fontSize: 13, color: '#065f46', fontWeight: '700' },

  // road type
  roadTypeRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roadChip:       { flexDirection: 'row', alignItems: 'center', gap: 6,
                    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 20,
                    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff' },
  roadChipActive: { borderColor: NAVY, backgroundColor: '#EBF0F9' },
  roadChipIcon:   { fontSize: 13 },
  roadChipText:   { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  roadChipTextActive:{ color: NAVY, fontWeight: '700' },

  // notes
  textarea:       { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14,
                    fontSize: 14, color: '#111827', minHeight: 84, backgroundColor: '#fff' },
  charCount:      { textAlign: 'right', fontSize: 11, color: '#9ca3af', marginTop: 4 },

  // severity
  severityRow:    { flexDirection: 'row', gap: 8 },
  severityBtn:    { flex: 1, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
                    paddingVertical: 12, alignItems: 'center', gap: 3, backgroundColor: '#fff' },
  severityEmoji:  { fontSize: 20 },
  severityLabel:  { fontSize: 11, color: '#6b7280', fontWeight: '500' },
  severitySla:    { fontSize: 9, color: '#9ca3af', fontWeight: '500' },

  // submit
  submitBtn:      { backgroundColor: GOLD, borderRadius: 16, paddingVertical: 18,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    gap: 10, marginTop: 24,
                    shadowColor: GOLD, shadowOpacity: 0.3, shadowRadius: 8,
                    shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  submitBtnDisabled:{ opacity: 0.5, shadowOpacity: 0 },
  submitBtnText:  { color: NAVY, fontSize: 17, fontWeight: '800' },
  submitPtsTag:   { backgroundColor: NAVY, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  submitPtsText:  { color: GOLD, fontSize: 12, fontWeight: '700' },
  disclaimer:     { textAlign: 'center', fontSize: 11, color: '#9ca3af', marginTop: 14, lineHeight: 16 },
});
