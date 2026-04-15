/**
 * MyReportsScreen — list of the user's submitted pothole reports
 * Brand: GHMC Navy #002B5C | Heritage Gold #F5A623 | tricolour stripe
 *
 * Features
 * ────────
 *   Filter tabs   → All / Open / Fixed
 *   Report cards  → left severity bar, 4-step timeline, fixed confirmation banner
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar,
} from 'react-native';

// ── brand ──────────────────────────────────────────────────────
const NAVY    = '#002B5C';
const GOLD    = '#F5A623';
const GREEN   = '#058541';
const SAFFRON = '#FF9933';

// ── types ──────────────────────────────────────────────────────
type Status   = 'pending' | 'in_progress' | 'fixed';
type Severity = 'low' | 'medium' | 'high' | 'critical';
type Filter   = 'all' | 'open' | 'fixed';

interface Report {
  id:       string;
  location: string;
  status:   Status;
  severity: Severity;
  time:     string;
}

// ── mock data ──────────────────────────────────────────────────
const REPORTS: Report[] = [
  { id: 'MR-A9F3', location: 'Abids, South Zone',          status: 'pending',     severity: 'high',     time: '2 min ago'   },
  { id: 'MR-B2C1', location: 'Banjara Hills, West Zone',   status: 'in_progress', severity: 'medium',   time: '3 days ago'  },
  { id: 'MR-D8E4', location: 'Secunderabad, Central Zone', status: 'fixed',       severity: 'critical', time: '12 days ago' },
  { id: 'MR-F1G7', location: 'Jubilee Hills, West Zone',   status: 'fixed',       severity: 'low',      time: '22 days ago' },
];

const STATUS_META: Record<Status, { label: string; color: string; bg: string }> = {
  pending:     { label: 'Pending',     color: '#E8961A', bg: 'rgba(232,150,26,.12)'  },
  in_progress: { label: 'In Progress', color: '#f97316', bg: 'rgba(249,115,22,.12)'  },
  fixed:       { label: 'Fixed',       color: GREEN,     bg: 'rgba(5,133,65,.12)'    },
};

const SEV_COLOR: Record<Severity, string> = {
  low:      '#22c55e',
  medium:   '#f59e0b',
  high:     '#f97316',
  critical: '#ef4444',
};

const TIMELINE_STEPS = ['Reported', 'Assigned', 'In Progress', 'Fixed'];
function stepIndex(status: Status) {
  return status === 'pending' ? 0 : status === 'in_progress' ? 2 : 3;
}

// ── Tricolour ──────────────────────────────────────────────────
function Tricolour() {
  return (
    <View style={{ flexDirection: 'row', height: 5 }}>
      <View style={{ flex: 1, backgroundColor: SAFFRON }} />
      <View style={{ flex: 1, backgroundColor: '#ffffff' }} />
      <View style={{ flex: 1, backgroundColor: GREEN }} />
    </View>
  );
}

// ── Component ──────────────────────────────────────────────────
export default function MyReportsScreen() {
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = REPORTS.filter(r => {
    if (filter === 'open')  return r.status !== 'fixed';
    if (filter === 'fixed') return r.status === 'fixed';
    return true;
  });

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Reports</Text>
        <Text style={styles.subtitle}>17 submitted · 12 fixed</Text>
      </View>
      <Tricolour />

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['all', 'open', 'fixed'] as Filter[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterPill, filter === f && styles.filterPillActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Report list */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 12, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        {filtered.map(r => {
          const sm  = STATUS_META[r.status];
          const idx = stepIndex(r.status);
          return (
            <View key={r.id} style={styles.card}>
              {/* Severity bar */}
              <View style={[styles.sevBar, { backgroundColor: SEV_COLOR[r.severity] }]} />

              <View style={styles.cardBody}>
                {/* Top row */}
                <View style={styles.cardTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardLocation}>📍 {r.location}</Text>
                    <Text style={styles.cardMeta}>{r.time} · #{r.id}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: sm.bg }]}>
                    <Text style={[styles.statusText, { color: sm.color }]}>{sm.label}</Text>
                  </View>
                </View>

                {/* 4-step timeline */}
                <View style={styles.timeline}>
                  {TIMELINE_STEPS.map((step, i) => (
                    <React.Fragment key={step}>
                      <View style={styles.timelineNode}>
                        <View style={[
                          styles.timelineDot,
                          { backgroundColor: i <= idx ? (i === idx ? sm.color : '#9ca3af') : '#e5e7eb' },
                          i === idx && { borderWidth: 2, borderColor: sm.color, backgroundColor: '#fff' },
                        ]} />
                      </View>
                      {i < TIMELINE_STEPS.length - 1 && (
                        <View style={[styles.timelineLine, { backgroundColor: i < idx ? '#9ca3af' : '#e5e7eb' }]} />
                      )}
                    </React.Fragment>
                  ))}
                </View>

                {/* Fixed confirmation banner */}
                {r.status === 'fixed' && (
                  <View style={styles.fixedBanner}>
                    <Text style={styles.fixedBannerText}>✅ Fixed! +10 pts for confirming</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: '#F5F6FA' },
  header:           { backgroundColor: NAVY, padding: 20, paddingTop: 16 },
  title:            { fontSize: 18, fontWeight: '800', color: '#fff' },
  subtitle:         { fontSize: 11, color: 'rgba(255,255,255,.5)', marginTop: 2 },
  filterRow:        { flexDirection: 'row', gap: 8, padding: 12, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  filterPill:       { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#f3f4f6' },
  filterPillActive: { backgroundColor: NAVY },
  filterText:       { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  filterTextActive: { color: '#fff' },
  scroll:           { flex: 1 },
  card:             { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0', overflow: 'hidden', elevation: 1, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  sevBar:           { width: 4 },
  cardBody:         { flex: 1, padding: 12 },
  cardTopRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardLocation:     { fontSize: 13, fontWeight: '700', color: '#111827' },
  cardMeta:         { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  statusBadge:      { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText:       { fontSize: 10, fontWeight: '700' },
  timeline:         { flexDirection: 'row', alignItems: 'center' },
  timelineNode:     { alignItems: 'center' },
  timelineDot:      { width: 10, height: 10, borderRadius: 5 },
  timelineLine:     { flex: 1, height: 2 },
  fixedBanner:      { marginTop: 10, backgroundColor: '#EDF7ED', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  fixedBannerText:  { fontSize: 12, color: GREEN, fontWeight: '600' },
});
