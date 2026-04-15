/**
 * HomeScreen — main dashboard
 * Brand: GHMC Navy #002B5C | Heritage Gold #F5A623 | tricolour stripe
 *
 * Sections
 * ────────
 *   Header      → app name, notification bell, avatar
 *   Greeting    → time-aware salutation, level pill, progress bar
 *   CTA card    → "Report a Pothole" → Camera
 *   Impact stats → Fixed / Total / Open nearby
 */
import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';

// ── brand ──────────────────────────────────────────────────────
const NAVY    = '#002B5C';
const GOLD    = '#F5A623';
const GREEN   = '#058541';
const SAFFRON = '#FF9933';

// ── level config ───────────────────────────────────────────────
const LEVELS = [
  { id: 'spotter',  name: 'Pothole Spotter', icon: '🔍', min: 0  },
  { id: 'scout',    name: 'Road Scout',       icon: '🗺️', min: 3  },
  { id: 'guardian', name: 'Street Guardian',  icon: '🛡️', min: 5  },
  { id: 'hero',     name: 'City Hero',        icon: '⭐', min: 10 },
  { id: 'legend',   name: 'Rasta Legend',     icon: '👑', min: 50 },
];

function getCurrentLevel(reports: number) {
  let current = LEVELS[0];
  for (const l of LEVELS) { if (reports >= l.min) current = l; }
  return current;
}
function getNextLevel(reports: number) {
  return LEVELS.find(l => l.min > reports) ?? null;
}
function getLevelProgress(reports: number) {
  const cur  = getCurrentLevel(reports);
  const next = getNextLevel(reports);
  if (!next) return 1;
  return Math.min((reports - cur.min) / (next.min - cur.min), 1);
}

// ── mock user (replace with auth store) ────────────────────────
const MOCK_USER = {
  name:    'Advaith',
  zone:    'Kukatpally Zone',
  ward:    'Ward 14',
  reports: 17,
  points:  340,
  fixed:   12,
  open:    5,
};

// ── Tricolour ──────────────────────────────────────────────────
function Tricolour() {
  return (
    <View style={styles.tricolour}>
      <View style={[styles.triStripe, { backgroundColor: SAFFRON }]} />
      <View style={[styles.triStripe, { backgroundColor: '#ffffff' }]} />
      <View style={[styles.triStripe, { backgroundColor: GREEN }]} />
    </View>
  );
}

// ── Component ──────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const user   = MOCK_USER;

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }, []);

  const curLevel  = getCurrentLevel(user.reports);
  const nextLevel = getNextLevel(user.reports);
  const progress  = getLevelProgress(user.reports);
  const ptsToNext = nextLevel
    ? (nextLevel.min - curLevel.min) * 20 - (user.reports - curLevel.min) * 20
    : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.brand}>
            <View style={styles.brandIcon}><Text style={styles.brandEmoji}>🛣️</Text></View>
            <View>
              <Text style={styles.brandName}>Mana Rasta</Text>
              <Text style={styles.brandSub}>GHMC Pothole Reporting</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn}>
              <Text style={{ fontSize: 16 }}>🔔</Text>
              <View style={styles.notifDot} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatar} onPress={() => router.push('/(tabs)/profile')}>
              <Text style={styles.avatarText}>{user.name[0]}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Greeting band ── */}
        <View style={styles.greetingBand}>
          <Text style={styles.greetingText}>{greeting}, {user.name} 👋</Text>
          <Text style={styles.greetingSub}>{user.zone} · Hyderabad</Text>

          {/* Level pill */}
          <View style={styles.levelPill}>
            <Text style={{ fontSize: 14 }}>{curLevel.icon}</Text>
            <Text style={styles.levelName}>{curLevel.name}</Text>
            <Text style={styles.levelPts}>
              · <Text style={{ color: GOLD, fontWeight: '700' }}>{user.points}</Text> pts
            </Text>
          </View>

          {/* Progress bar */}
          <View style={styles.progRow}>
            <Text style={styles.progLabel}>Level {LEVELS.indexOf(curLevel) + 1}</Text>
            <View style={styles.progTrack}>
              <View style={[styles.progFill, { width: `${progress * 100}%` as any }]} />
            </View>
            <Text style={styles.progLabel}>{nextLevel ? nextLevel.name + ' ' + nextLevel.icon : 'Max'}</Text>
          </View>
          {nextLevel && (
            <Text style={styles.ptsToNext}>{ptsToNext} pts to next level</Text>
          )}
        </View>
      </View>

      <Tricolour />

      {/* ── Curved divider ── */}
      <View style={styles.curvedBot} />

      {/* ── Scroll content ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* CTA card */}
        <TouchableOpacity
          style={styles.ctaCard}
          onPress={() => router.push('/camera')}
          activeOpacity={0.88}
        >
          <View style={styles.ctaTop}>
            <View style={styles.ctaIcon}><Text style={{ fontSize: 26 }}>📷</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ctaHeading}>{'Spot a pothole?\nReport it now.'}</Text>
              <Text style={styles.ctaSub}>{'Photo · GPS · Under 60 seconds.\nGoes straight to your Ward AE.'}</Text>
            </View>
          </View>
          <View style={styles.ctaBtnBar}>
            <Text style={styles.ctaBtnText}>Report a Pothole</Text>
            <View style={styles.ctaPts}><Text style={styles.ctaPtsText}>+20 pts</Text></View>
          </View>
        </TouchableOpacity>

        {/* Stats */}
        <Text style={styles.sectionLabel}>Your impact</Text>
        <View style={styles.statsRow}>
          {[
            { icon: '✅', value: user.fixed,   color: GREEN,   label: 'Fixed this\nmonth' },
            { icon: '📋', value: user.reports, color: NAVY,    label: 'Total\nreports'    },
            { icon: '📍', value: user.open,    color: '#E8961A', label: 'Open near\nyou' },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statIcon}>{s.icon}</Text>
              <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: NAVY },
  header:        { backgroundColor: NAVY },
  headerRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, paddingHorizontal: 20 },
  brand:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandIcon:     { width: 34, height: 34, backgroundColor: 'rgba(245,166,35,.15)', borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(245,166,35,.25)' },
  brandEmoji:    { fontSize: 18 },
  brandName:     { fontSize: 19, fontWeight: '800', color: '#fff', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  brandSub:      { fontSize: 9.5, color: 'rgba(255,255,255,.5)', fontWeight: '500', letterSpacing: 0.3 },
  headerActions: { flexDirection: 'row', gap: 10 },
  iconBtn:       { width: 36, height: 36, backgroundColor: 'rgba(255,255,255,.1)', borderRadius: 11, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  notifDot:      { position: 'absolute', top: 7, right: 8, width: 7, height: 7, backgroundColor: GOLD, borderRadius: 3.5, borderWidth: 1.5, borderColor: NAVY },
  avatar:        { width: 36, height: 36, backgroundColor: GOLD, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(245,166,35,.5)' },
  avatarText:    { fontSize: 15, fontWeight: '800', color: NAVY },
  greetingBand:  { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  greetingText:  { fontSize: 20, fontWeight: '800', color: '#fff', lineHeight: 26 },
  greetingSub:   { fontSize: 12, color: 'rgba(255,255,255,.55)', marginTop: 2 },
  levelPill:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(245,166,35,.15)', borderWidth: 1, borderColor: 'rgba(245,166,35,.35)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 10 },
  levelName:     { fontSize: 11, fontWeight: '700', color: GOLD },
  levelPts:      { fontSize: 11, color: 'rgba(255,255,255,.5)' },
  progRow:       { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  progLabel:     { fontSize: 10, color: 'rgba(255,255,255,.4)' },
  progTrack:     { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,.12)', borderRadius: 99, marginHorizontal: 10, overflow: 'hidden' },
  progFill:      { height: '100%', backgroundColor: GOLD, borderRadius: 99 },
  ptsToNext:     { fontSize: 10, color: 'rgba(255,255,255,.3)', textAlign: 'right', marginTop: 3 },
  tricolour:     { flexDirection: 'row', height: 5 },
  triStripe:     { flex: 1 },
  curvedBot:     { backgroundColor: NAVY, height: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  scroll:        { flex: 1, backgroundColor: '#F5F6FA', marginTop: -2 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  ctaCard:       { backgroundColor: NAVY, borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,.06)', elevation: 4, shadowColor: NAVY, shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  ctaTop:        { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 14 },
  ctaIcon:       { width: 52, height: 52, backgroundColor: 'rgba(245,166,35,.15)', borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(245,166,35,.25)' },
  ctaHeading:    { fontSize: 16, fontWeight: '800', color: '#fff', lineHeight: 22 },
  ctaSub:        { fontSize: 11, color: 'rgba(255,255,255,.55)', marginTop: 4, lineHeight: 17 },
  ctaBtnBar:     { backgroundColor: GOLD, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ctaBtnText:    { fontSize: 13.5, fontWeight: '800', color: NAVY, letterSpacing: 0.15 },
  ctaPts:        { backgroundColor: 'rgba(0,43,92,.15)', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  ctaPtsText:    { fontSize: 11, fontWeight: '700', color: NAVY },
  sectionLabel:  { fontSize: 11, fontWeight: '700', color: NAVY, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10, marginTop: 18 },
  statsRow:      { flexDirection: 'row', gap: 10 },
  statCard:      { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 13, borderWidth: 1, borderColor: '#eef0f4', elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  statIcon:      { fontSize: 18, marginBottom: 6 },
  statVal:       { fontSize: 22, fontWeight: '800', lineHeight: 24 },
  statLabel:     { fontSize: 10, color: '#8a8fa8', marginTop: 3, lineHeight: 14 },
});
