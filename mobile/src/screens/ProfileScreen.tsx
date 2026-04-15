/**
 * ProfileScreen — user profile, stats, and app settings
 * Brand: GHMC Navy #002B5C | Heritage Gold #F5A623 | tricolour stripe
 */
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';

const NAVY    = '#002B5C';
const GOLD    = '#F5A623';
const GREEN   = '#058541';
const SAFFRON = '#FF9933';

// ── mock user ──────────────────────────────────────────────────
const USER = { name: 'Advaith K.', zone: 'Kukatpally Zone', ward: 'Ward 14', reports: 17, fixed: 12, points: 340, streak: 7, level: 'Street Guardian', levelIcon: '🛡️' };

function Tricolour() {
  return (
    <View style={{ flexDirection: 'row', height: 5 }}>
      <View style={{ flex: 1, backgroundColor: SAFFRON }} />
      <View style={{ flex: 1, backgroundColor: '#ffffff' }} />
      <View style={{ flex: 1, backgroundColor: GREEN }} />
    </View>
  );
}

function MenuItem({ icon, label, value, onPress, danger }: { icon: string; label: string; value?: string; onPress?: () => void; danger?: boolean }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.menuIcon}>{icon}</Text>
      <Text style={[styles.menuLabel, danger && { color: '#EF4444' }]}>{label}</Text>
      {value && <Text style={styles.menuValue}>{value}</Text>}
      <Text style={styles.menuArrow}>›</Text>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router        = useRouter();
  const { signOut }   = useAuthStore();

  const handleSignOut = () => {
    signOut();
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{USER.name[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{USER.name}</Text>
            <Text style={styles.zone}>{USER.zone}</Text>
            <View style={styles.levelPill}>
              <Text style={{ fontSize: 12 }}>{USER.levelIcon}</Text>
              <Text style={styles.levelText}>{USER.level}</Text>
            </View>
          </View>
        </View>
      </View>
      <Tricolour />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { val: USER.reports, label: 'Reports' },
            { val: USER.fixed,   label: 'Fixed'   },
            { val: USER.points,  label: 'Points'  },
            { val: `${USER.streak}🔥`, label: 'Streak' },
          ].map((s, i, arr) => (
            <React.Fragment key={s.label}>
              <View style={styles.stat}>
                <Text style={styles.statVal}>{s.val}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
              {i < arr.length - 1 && <View style={styles.statDivider} />}
            </React.Fragment>
          ))}
        </View>

        {/* Account section */}
        <Text style={styles.sectionHead}>Account</Text>
        <View style={styles.menuGroup}>
          <MenuItem icon="👤" label="Edit Profile" />
          <MenuItem icon="🔔" label="Notifications" />
          <MenuItem icon="📍" label="My Zone" value={USER.ward} />
          <MenuItem icon="📋" label="My Reports" onPress={() => router.push('/(tabs)/myreports')} />
        </View>

        {/* App section */}
        <Text style={styles.sectionHead}>App</Text>
        <View style={styles.menuGroup}>
          <MenuItem icon="❓" label="How it works" />
          <MenuItem icon="📣" label="Give feedback" />
          <MenuItem icon="🔒" label="Privacy & Terms" />
          <MenuItem icon="🚪" label="Sign out" onPress={handleSignOut} danger />
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#F5F6FA' },
  header:      { backgroundColor: NAVY, padding: 20, paddingTop: 16 },
  profileRow:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar:      { width: 72, height: 72, backgroundColor: GOLD, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { fontSize: 30, fontWeight: '800', color: NAVY },
  name:        { fontSize: 20, fontWeight: '800', color: '#fff' },
  zone:        { fontSize: 12, color: 'rgba(255,255,255,.55)', marginTop: 2 },
  levelPill:   { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(245,166,35,.15)', borderWidth: 1, borderColor: 'rgba(245,166,35,.3)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 6 },
  levelText:   { fontSize: 11, fontWeight: '700', color: GOLD },
  scroll:      { flex: 1 },
  statsRow:    { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eef0f4' },
  stat:        { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statVal:     { fontSize: 22, fontWeight: '800', color: NAVY },
  statLabel:   { fontSize: 11, color: '#8a8fa8', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#eef0f4' },
  sectionHead: { fontSize: 11, fontWeight: '700', color: '#8a8fa8', textTransform: 'uppercase', letterSpacing: 0.6, padding: 14, paddingBottom: 8 },
  menuGroup:   { backgroundColor: '#fff', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#eef0f4' },
  menuItem:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f5f6fa' },
  menuIcon:    { fontSize: 18 },
  menuLabel:   { flex: 1, fontSize: 14, fontWeight: '500', color: '#111827' },
  menuValue:   { fontSize: 12, color: '#8a8fa8', marginRight: 8 },
  menuArrow:   { color: '#9ca3af', fontSize: 18 },
});
