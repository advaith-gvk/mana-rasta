/**
 * PrivacyTermsScreen.tsx
 * ─────────────────────────────────────────────────────────────
 * Two-tab screen: Privacy Policy | Terms of Use.
 * All content is static — no network calls.
 * Accessible from Profile → Privacy & Terms.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  SafeAreaView, StatusBar, TouchableOpacity, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';

const NAVY  = '#002B5C';
const GREEN = '#058541';

type Tab = 'privacy' | 'terms';

const PRIVACY_SECTIONS = [
  {
    heading: 'What we collect',
    body: 'Your mobile number (for login), photos you take of potholes, your device GPS coordinates at the time of a report, and your in-app activity (points, badges, streaks).',
  },
  {
    heading: 'What we do NOT collect',
    body: 'We never access your camera roll or gallery. Photos are captured exclusively through the in-app camera and are not stored on your device after submission.',
  },
  {
    heading: 'How your data is used',
    body: 'Report data (photo + location + severity) is transmitted to GHMC via the Integrated Grievance System for repair assignment. Your phone number is used only for OTP authentication and is never shared with third parties.',
  },
  {
    heading: 'Location data',
    body: 'GPS is accessed only when you are actively filing a report. We do not track your location in the background.',
  },
  {
    heading: 'Voucher partners',
    body: 'Redemption data (voucher code used) is shared with partner platforms (Swiggy, Zomato, Amazon Pay) solely to validate the reward. No personal data beyond a hashed identifier is shared.',
  },
  {
    heading: 'Data retention',
    body: 'Report data is retained for 3 years per GHMC record-keeping guidelines. You may request deletion of your account and associated data at any time from Edit Profile.',
  },
  {
    heading: 'Contact',
    body: 'For privacy concerns write to privacy@manarasta.in or use the Give Feedback option in the app.',
  },
];

const TERMS_SECTIONS = [
  {
    heading: 'Eligibility',
    body: 'Mana Rasta is available to residents of the Greater Hyderabad Municipal Corporation (GHMC) limits who are 18 years of age or older.',
  },
  {
    heading: 'Accurate reporting',
    body: 'You agree to submit only genuine pothole reports from real locations within GHMC limits. Fabricated or duplicate reports will result in account suspension.',
  },
  {
    heading: 'Photo content',
    body: "Photos submitted must depict the actual pothole being reported. Photos containing people's faces, licence plates, or irrelevant content may be rejected by our moderation system.",
  },
  {
    heading: 'Points & rewards',
    body: "Points are awarded at GHMC's discretion upon report verification. Mana Rasta reserves the right to adjust, withhold, or revoke points if misuse is detected. Vouchers have individual expiry dates and partner-specific terms.",
  },
  {
    heading: 'No guarantee of repair',
    body: "Submission of a report does not guarantee repair within any specific timeline. Mana Rasta is a civic reporting tool; repair scheduling is solely at GHMC's discretion.",
  },
  {
    heading: 'Prohibited use',
    body: 'You may not use the app to submit spam, harass GHMC staff, or attempt to manipulate the leaderboard through automated or bulk submissions.',
  },
  {
    heading: 'Governing law',
    body: 'These terms are governed by the laws of Telangana, India. Disputes shall be subject to the exclusive jurisdiction of courts in Hyderabad.',
  },
];

function SectionList({ sections }: { sections: typeof PRIVACY_SECTIONS }) {
  return (
    <>
      <Text style={styles.updated}>Last updated: 1 April 2025</Text>
      {sections.map(s => (
        <View key={s.heading} style={styles.section}>
          <Text style={styles.sectionHeading}>{s.heading}</Text>
          <Text style={styles.sectionBody}>{s.body}</Text>
        </View>
      ))}
    </>
  );
}

export function PrivacyTermsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('privacy');

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy &amp; Terms</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tricolour stripe */}
      <View style={styles.tricolour}>
        {['#FF9933', '#FFFFFF', GREEN].map(c => (
          <View key={c} style={[styles.stripe, { backgroundColor: c }]} />
        ))}
      </View>

      {/* Sub-tab bar */}
      <View style={styles.tabBar}>
        {(['privacy', 'terms'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === 'privacy' ? 'Privacy Policy' : 'Terms of Use'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        key={activeTab}  // remount scroll to top on tab switch
      >
        {activeTab === 'privacy'
          ? <SectionList sections={PRIVACY_SECTIONS} />
          : <SectionList sections={TERMS_SECTIONS} />}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

export default PrivacyTermsScreen;

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: NAVY },
  scroll:          { flex: 1, backgroundColor: '#F8F9FA' },
  scrollContent:   { padding: 20, paddingBottom: 40 },

  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                     paddingHorizontal: 16,
                     paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 14,
                     backgroundColor: NAVY },
  backBtn:         { width: 40, height: 40, justifyContent: 'center' },
  backArrow:       { color: '#fff', fontSize: 22, fontWeight: '300' },
  headerTitle:     { color: '#fff', fontSize: 17, fontWeight: '700' },

  tricolour:       { flexDirection: 'row', height: 9 },
  stripe:          { flex: 1 },

  tabBar:          { flexDirection: 'row', backgroundColor: '#fff',
                     borderBottomWidth: 1, borderBottomColor: '#eef0f4' },
  tab:             { flex: 1, paddingVertical: 13, alignItems: 'center',
                     borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:       { borderBottomColor: NAVY },
  tabText:         { fontSize: 13, fontWeight: '700', color: '#9ca3af' },
  tabTextActive:   { color: NAVY },

  updated:         { fontSize: 11, color: '#9ca3af', marginBottom: 16 },
  section:         { marginBottom: 20 },
  sectionHeading:  { fontSize: 13, fontWeight: '700', color: NAVY, marginBottom: 6 },
  sectionBody:     { fontSize: 13, color: '#374151', lineHeight: 21 },
});
