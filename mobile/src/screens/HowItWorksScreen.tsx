/**
 * HowItWorksScreen.tsx
 * ─────────────────────────────────────────────────────────────
 * Static explainer — 5-step flow, points guide, level ladder.
 * Accessible from Profile → How it Works.
 */
import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  SafeAreaView, StatusBar, TouchableOpacity, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';

const NAVY  = '#002B5C';
const GOLD  = '#F5A623';
const GREEN = '#058541';

const STEPS = [
  {
    n: '1',
    icon: '📷',
    title: 'Photograph the pothole',
    body: 'Open the camera, align the pothole inside the guide box. Mana Rasta checks sharpness, exposure, and steadiness before it lets you capture.',
  },
  {
    n: '2',
    icon: '📍',
    title: 'Confirm location',
    body: "Your GPS pin is auto-detected and matched to a GHMC ward and zone. You can't submit a report outside GHMC limits.",
  },
  {
    n: '3',
    icon: '⚠️',
    title: 'Set severity',
    body: 'Rate it Low → Critical. This sets the SLA — critical potholes get a 24-hour repair commitment from the Ward AE.',
  },
  {
    n: '4',
    icon: '📤',
    title: 'Submit to GHMC',
    body: 'Your report is sent via the GHMC Integrated Grievance System (IGS) under Engineering → Repairs to Road (Pot Holes).',
  },
  {
    n: '5',
    icon: '🏆',
    title: 'Earn points & badges',
    body: 'Earn 20 pts per verified report. Hit milestones to unlock badges and vouchers from Swiggy, Zomato, and Amazon Pay.',
    last: true,
  },
] as const;

const POINTS = [
  { label: 'Submit a verified report',        pts: '20 pts'     },
  { label: 'Report gets fixed',               pts: '+10 bonus'  },
  { label: '7-day reporting streak',          pts: '25 pts'     },
  { label: 'First report of the day',         pts: '5 pts'      },
  { label: 'Quality photo (all chips green)', pts: '+5 bonus'   },
];

const LEVELS = [
  { label: '🔍 Pothole Spotter',  range: '0 – 99 pts'      },
  { label: '🚦 Road Watcher',     range: '100 – 299 pts'   },
  { label: '🏗 Street Guardian',  range: '300 – 599 pts'   },
  { label: '🌟 City Hero',        range: '600 – 999 pts'   },
  { label: '👑 Rasta Legend',     range: '1000+ pts'       },
];

export function HowItWorksScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>How it Works</Text>
        <View style={{ width: 40 }} />
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
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🛣️</Text>
          <Text style={styles.heroTitle}>Mana Rasta</Text>
          <Text style={styles.heroSub}>
            Your reports go directly to GHMC Ward engineers.{'\n'}
            Every verified report triggers a repair ticket.
          </Text>
        </View>

        {/* Steps */}
        {STEPS.map(s => (
          <View key={s.n} style={styles.stepRow}>
            <View style={styles.stepLeft}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNum}>{s.n}</Text>
              </View>
              {!s.last && <View style={styles.stepConnector} />}
            </View>
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>{s.icon}  {s.title}</Text>
              <Text style={styles.stepText}>{s.body}</Text>
            </View>
          </View>
        ))}

        {/* Points Guide */}
        <Text style={styles.tableHeader}>Points Guide</Text>
        <View style={styles.table}>
          {POINTS.map((p, i) => (
            <View
              key={p.label}
              style={[styles.tableRow, i === POINTS.length - 1 && styles.tableRowLast]}
            >
              <Text style={styles.tableLabel}>{p.label}</Text>
              <Text style={styles.tableValue}>{p.pts}</Text>
            </View>
          ))}
        </View>

        {/* Level Ladder */}
        <Text style={styles.tableHeader}>Level Ladder</Text>
        <View style={styles.table}>
          {LEVELS.map((l, i) => (
            <View
              key={l.label}
              style={[styles.tableRow, i === LEVELS.length - 1 && styles.tableRowLast]}
            >
              <Text style={styles.tableLabel}>{l.label}</Text>
              <Text style={styles.tableRange}>{l.range}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

export default HowItWorksScreen;

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: NAVY },
  scroll:         { flex: 1, backgroundColor: '#F8F9FA' },
  scrollContent:  { padding: 20, paddingBottom: 40 },

  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingHorizontal: 16,
                    paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 14,
                    backgroundColor: NAVY },
  backBtn:        { width: 40, height: 40, justifyContent: 'center' },
  backArrow:      { color: '#fff', fontSize: 22, fontWeight: '300' },
  headerTitle:    { color: '#fff', fontSize: 17, fontWeight: '700' },

  tricolour:      { flexDirection: 'row', height: 9 },
  stripe:         { flex: 1 },

  hero:           { backgroundColor: NAVY, borderRadius: 20, padding: 24,
                    alignItems: 'center', marginBottom: 24 },
  heroEmoji:      { fontSize: 48, marginBottom: 10 },
  heroTitle:      { color: GOLD, fontSize: 20, fontWeight: '800', marginBottom: 6 },
  heroSub:        { color: 'rgba(255,255,255,0.75)', fontSize: 13,
                    lineHeight: 20, textAlign: 'center' },

  stepRow:        { flexDirection: 'row', gap: 14, marginBottom: 4 },
  stepLeft:       { alignItems: 'center', width: 36 },
  stepBadge:      { width: 36, height: 36, borderRadius: 18, backgroundColor: NAVY,
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepNum:        { color: GOLD, fontSize: 13, fontWeight: '800' },
  stepConnector:  { width: 2, flex: 1, backgroundColor: '#e5e7eb', marginVertical: 4, minHeight: 24 },
  stepBody:       { flex: 1, paddingTop: 6, paddingBottom: 20 },
  stepTitle:      { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 4 },
  stepText:       { fontSize: 13, color: '#6b7280', lineHeight: 20 },

  tableHeader:    { fontSize: 11, fontWeight: '700', color: NAVY, textTransform: 'uppercase',
                    letterSpacing: 0.5, marginTop: 8, marginBottom: 8 },
  table:          { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
                    borderWidth: 1, borderColor: '#eef0f4', marginBottom: 20 },
  tableRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingHorizontal: 16, paddingVertical: 12,
                    borderBottomWidth: 1, borderBottomColor: '#f5f6fa' },
  tableRowLast:   { borderBottomWidth: 0 },
  tableLabel:     { fontSize: 13, color: '#374151', flex: 1 },
  tableValue:     { fontSize: 13, fontWeight: '700', color: GOLD },
  tableRange:     { fontSize: 12, fontWeight: '600', color: '#9ca3af' },
});
