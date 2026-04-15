/**
 * NotificationsScreen.tsx
 * ─────────────────────────────────────────────────────────────
 * User notification preferences + recent notification feed.
 * Accessible from:
 *   • Home screen header bell icon (→ showScreen('notifications') in HTML)
 *   • Profile → Notifications menu row
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  SafeAreaView, StatusBar, TouchableOpacity, Switch, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';

const NAVY  = '#002B5C';
const GOLD  = '#F5A623';
const GREEN = '#058541';

type NotifPref = {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  iconBg: string;
  defaultOn: boolean;
};

const PREFS: NotifPref[] = [
  { id: 'report_updates', icon: '📋', title: 'Report updates',      subtitle: 'Status changes, AE comments',             iconBg: '#EBF0F9', defaultOn: true  },
  { id: 'fix_confirmed', icon: '✅', title: 'Fix confirmed',        subtitle: 'When GHMC marks your pothole fixed',       iconBg: '#EDF7ED', defaultOn: true  },
  { id: 'points_badges', icon: '🏆', title: 'Points & badges',      subtitle: 'Rewards, level-ups, new badges',          iconBg: '#FFF8E7', defaultOn: true  },
  { id: 'streak',        icon: '🔥', title: 'Streak reminders',     subtitle: 'Daily nudge to keep your streak',         iconBg: '#FFF3E8', defaultOn: false },
  { id: 'sla_alerts',   icon: '⚠️', title: 'SLA breach alerts',    subtitle: 'When repair deadline is overdue',         iconBg: '#FEF2F2', defaultOn: true  },
];

type RecentNotif = {
  icon: string;
  iconBg: string;
  title: string;
  body: string;
  time: string;
};

const RECENT: RecentNotif[] = [
  { icon: '✅', iconBg: '#EDF7ED', title: 'Pothole fixed on MG Road',      body: 'GHMC confirmed repair · +10 pts earned',                      time: '2 hours ago'  },
  { icon: '🏆', iconBg: '#FFF8E7', title: 'New badge unlocked!',            body: 'You earned the Street Guardian 🛡️ badge',                     time: 'Yesterday'    },
  { icon: '📋', iconBg: '#EBF0F9', title: 'Report acknowledged',            body: 'AE Rajesh Kumar assigned your Kukatpally report',             time: '2 days ago'   },
  { icon: '⚠️', iconBg: '#FEF2F2', title: 'SLA deadline approaching',      body: 'High-severity report due for repair in 6 hours',             time: '3 days ago'   },
];

export function NotificationsScreen() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Record<string, boolean>>(
    Object.fromEntries(PREFS.map(p => [p.id, p.defaultOn])),
  );

  const toggle = (id: string) =>
    setPrefs(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
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
        {/* Preferences */}
        <Text style={styles.sectionLabel}>Preferences</Text>
        <View style={styles.card}>
          {PREFS.map((pref, i) => (
            <View
              key={pref.id}
              style={[styles.prefRow, i < PREFS.length - 1 && styles.prefRowBorder]}
            >
              <View style={[styles.prefIcon, { backgroundColor: pref.iconBg }]}>
                <Text style={styles.prefIconText}>{pref.icon}</Text>
              </View>
              <View style={styles.prefText}>
                <Text style={styles.prefTitle}>{pref.title}</Text>
                <Text style={styles.prefSub}>{pref.subtitle}</Text>
              </View>
              <Switch
                value={prefs[pref.id]}
                onValueChange={() => toggle(pref.id)}
                trackColor={{ false: '#d1d5db', true: NAVY }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>

        {/* Recent */}
        <Text style={styles.sectionLabel}>Recent</Text>
        <View style={styles.card}>
          {RECENT.map((n, i) => (
            <View
              key={i}
              style={[styles.notifRow, i < RECENT.length - 1 && styles.prefRowBorder]}
            >
              <View style={[styles.notifIcon, { backgroundColor: n.iconBg }]}>
                <Text style={styles.prefIconText}>{n.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.notifTitle}>{n.title}</Text>
                <Text style={styles.notifBody}>{n.body}</Text>
                <Text style={styles.notifTime}>{n.time}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

export default NotificationsScreen;

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: NAVY },
  scroll:        { flex: 1, backgroundColor: '#F8F9FA' },
  scrollContent: { padding: 20, paddingBottom: 40 },

  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                   paddingHorizontal: 16,
                   paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 14,
                   backgroundColor: NAVY },
  backBtn:       { width: 40, height: 40, justifyContent: 'center' },
  backArrow:     { color: '#fff', fontSize: 22, fontWeight: '300' },
  headerTitle:   { color: '#fff', fontSize: 17, fontWeight: '700' },

  tricolour:     { flexDirection: 'row', height: 9 },
  stripe:        { flex: 1 },

  sectionLabel:  { fontSize: 11, fontWeight: '700', color: '#8a8fa8',
                   textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10, marginTop: 4 },

  card:          { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
                   borderWidth: 1, borderColor: '#eef0f4', marginBottom: 20 },

  prefRow:       { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  prefRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f5f6fa' },
  prefIcon:      { width: 36, height: 36, borderRadius: 11,
                   alignItems: 'center', justifyContent: 'center' },
  prefIconText:  { fontSize: 17 },
  prefText:      { flex: 1 },
  prefTitle:     { fontSize: 14, fontWeight: '600', color: '#111827' },
  prefSub:       { fontSize: 11, color: '#9ca3af', marginTop: 2 },

  notifRow:      { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
  notifIcon:     { width: 40, height: 40, borderRadius: 12,
                   alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notifTitle:    { fontSize: 13, fontWeight: '600', color: '#111827', marginBottom: 2 },
  notifBody:     { fontSize: 12, color: '#6b7280', lineHeight: 17 },
  notifTime:     { fontSize: 11, color: '#9ca3af', marginTop: 4 },
});
