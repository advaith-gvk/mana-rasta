/**
 * ReportSuccessScreen — post-submission confirmation
 * Shown after a citizen successfully submits a pothole report.
 * Brand: GHMC Navy #002B5C | Heritage Gold #F5A623
 * Navigation: Expo Router (useLocalSearchParams / useRouter)
 */
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, StatusBar, Animated, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

// ── constants ─────────────────────────────────────────────────
const NAVY  = '#002B5C';
const GOLD  = '#F5A623';
const GREEN = '#058541';

// ── component ─────────────────────────────────────────────────
export function ReportSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    reportId: string;
    wardName: string;
    zoneName: string;
    points:   string;
  }>();

  const { reportId, wardName, zoneName, points = '20' } = params;

  // Scale-in animation for the badge
  const scale = useRef(new Animated.Value(0)).current;
  const fade  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(150),
      Animated.parallel([
        Animated.spring(scale, {
          toValue:         1,
          useNativeDriver: true,
          tension:         60,
          friction:        8,
        }),
        Animated.timing(fade, {
          toValue:         1,
          duration:        400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <Text style={styles.brand}>Mana Rasta</Text>
      </View>

      {/* ── Tricolour stripe ── */}
      <View style={styles.tricolour}>
        <View style={[styles.stripe, { backgroundColor: '#FF9933' }]} />
        <View style={[styles.stripe, { backgroundColor: '#FFFFFF' }]} />
        <View style={[styles.stripe, { backgroundColor: GREEN }]} />
      </View>

      <Animated.View style={[styles.body, { opacity: fade }]}>

        {/* ── Hero card ── */}
        <View style={styles.heroCard}>

          {/* animated checkmark */}
          <Animated.View style={[styles.checkCircle, { transform: [{ scale }] }]}>
            <Text style={styles.checkMark}>✓</Text>
          </Animated.View>

          <Text style={styles.heroHeading}>Report Submitted!</Text>
          <Text style={styles.heroSub}>
            Your pothole has been reported to the Ward AE/DEE. GHMC will assign it for repair.
          </Text>

          {/* ── Points badge ── */}
          <View style={styles.pointsBadge}>
            <Text style={styles.pointsPlus}>+{points}</Text>
            <Text style={styles.pointsLabel}>points earned</Text>
          </View>
        </View>

        {/* ── Report details ── */}
        <View style={styles.detailCard}>
          {reportId ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>Report ID</Text>
              <View style={styles.reportIdChip}>
                <Text style={styles.reportIdText}>#{reportId.slice(-8).toUpperCase()}</Text>
              </View>
            </View>
          ) : null}

          {(wardName || zoneName) ? (
            <View style={[styles.detailRow, styles.detailRowBorder]}>
              <Text style={styles.detailKey}>Location</Text>
              <Text style={styles.detailValue}>
                {[wardName, zoneName ? `${zoneName} Zone` : ''].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ) : null}

          <View style={[styles.detailRow, styles.detailRowBorder]}>
            <Text style={styles.detailKey}>Category</Text>
            <Text style={styles.detailValue}>Engineering → Repairs to Road (Pot Holes)</Text>
          </View>

          <View style={[styles.detailRow, styles.detailRowBorder]}>
            <Text style={styles.detailKey}>Status</Text>
            <View style={styles.statusChip}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Pending assignment</Text>
            </View>
          </View>
        </View>

        {/* ── What happens next ── */}
        <View style={styles.nextCard}>
          <Text style={styles.nextTitle}>What happens next?</Text>
          <View style={styles.nextStep}>
            <View style={[styles.nextDot, { backgroundColor: '#f97316' }]} />
            <Text style={styles.nextText}>Ward AE/DEE receives your report immediately</Text>
          </View>
          <View style={styles.nextStep}>
            <View style={[styles.nextDot, { backgroundColor: GOLD }]} />
            <Text style={styles.nextText}>Repair is scheduled within SLA (24h–7 days by severity)</Text>
          </View>
          <View style={styles.nextStep}>
            <View style={[styles.nextDot, { backgroundColor: GREEN }]} />
            <Text style={styles.nextText}>You'll be notified when fixed — confirm to earn +10 pts</Text>
          </View>
        </View>

        {/* ── CTAs ── */}
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.replace('/(tabs)/my-reports')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>View My Reports</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.replace('/report')}
          activeOpacity={0.75}
        >
          <Text style={styles.secondaryBtnText}>Report Another Pothole</Text>
        </TouchableOpacity>

      </Animated.View>
    </SafeAreaView>
  );
}

// ── styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: NAVY },

  // header
  topBar:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                       paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0,
                       paddingBottom: 14, backgroundColor: NAVY },
  brand:             { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                       fontSize: 22, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3 },

  // tricolour
  tricolour:         { flexDirection: 'row', height: 9 },
  stripe:            { flex: 1 },

  body:              { flex: 1, backgroundColor: '#F8F9FA', paddingHorizontal: 20,
                       paddingTop: 28, paddingBottom: 32 },

  // hero card
  heroCard:          { backgroundColor: NAVY, borderRadius: 20, padding: 28,
                       alignItems: 'center', marginBottom: 16,
                       shadowColor: '#000', shadowOpacity: 0.15,
                       shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  checkCircle:       { width: 72, height: 72, borderRadius: 36,
                       backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center',
                       marginBottom: 16,
                       shadowColor: GREEN, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  checkMark:         { color: '#fff', fontSize: 36, fontWeight: '700', lineHeight: 42 },
  heroHeading:       { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 8,
                       textAlign: 'center' },
  heroSub:           { color: 'rgba(255,255,255,0.75)', fontSize: 13, textAlign: 'center',
                       lineHeight: 20, marginBottom: 20 },
  pointsBadge:       { backgroundColor: GOLD, borderRadius: 14, paddingHorizontal: 24,
                       paddingVertical: 10, alignItems: 'center',
                       shadowColor: GOLD, shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  pointsPlus:        { color: NAVY, fontSize: 28, fontWeight: '900', lineHeight: 32 },
  pointsLabel:       { color: NAVY, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  // detail card
  detailCard:        { backgroundColor: '#fff', borderRadius: 16, padding: 16,
                       marginBottom: 12, borderWidth: 1, borderColor: '#f0f0f0' },
  detailRow:         { flexDirection: 'row', justifyContent: 'space-between',
                       alignItems: 'center', paddingVertical: 8 },
  detailRowBorder:   { borderTopWidth: 1, borderTopColor: '#f5f5f5' },
  detailKey:         { fontSize: 12, color: '#9ca3af', fontWeight: '600',
                       textTransform: 'uppercase', letterSpacing: 0.4, flex: 0.45 },
  detailValue:       { fontSize: 12, color: '#374151', fontWeight: '500',
                       flex: 0.55, textAlign: 'right' },
  reportIdChip:      { backgroundColor: '#EBF0F9', borderRadius: 6,
                       paddingHorizontal: 10, paddingVertical: 4 },
  reportIdText:      { fontSize: 12, color: NAVY, fontWeight: '700', letterSpacing: 1 },
  statusChip:        { flexDirection: 'row', alignItems: 'center', gap: 5,
                       backgroundColor: '#fff7ed', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  statusDot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f97316' },
  statusText:        { fontSize: 11, color: '#c2410c', fontWeight: '600' },

  // what's next
  nextCard:          { backgroundColor: '#fff', borderRadius: 16, padding: 16,
                       marginBottom: 20, borderWidth: 1, borderColor: '#f0f0f0' },
  nextTitle:         { fontSize: 13, fontWeight: '700', color: NAVY, marginBottom: 12 },
  nextStep:          { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  nextDot:           { width: 8, height: 8, borderRadius: 4, marginTop: 4, flexShrink: 0 },
  nextText:          { fontSize: 13, color: '#374151', lineHeight: 18, flex: 1 },

  // CTAs
  primaryBtn:        { backgroundColor: GOLD, borderRadius: 16, paddingVertical: 17,
                       alignItems: 'center', marginBottom: 10,
                       shadowColor: GOLD, shadowOpacity: 0.3, shadowRadius: 8,
                       shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  primaryBtnText:    { color: NAVY, fontSize: 16, fontWeight: '800' },
  secondaryBtn:      { backgroundColor: 'transparent', borderRadius: 16, paddingVertical: 15,
                       alignItems: 'center', borderWidth: 1.5, borderColor: NAVY },
  secondaryBtnText:  { color: NAVY, fontSize: 15, fontWeight: '600' },
});
