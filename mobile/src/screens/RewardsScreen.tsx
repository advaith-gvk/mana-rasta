/**
 * RewardsScreen — badges, leaderboard, and vouchers
 * Brand: GHMC Navy #002B5C | Heritage Gold #F5A623 | tricolour stripe
 *
 * Tabs
 * ────
 *   Badges      → earned (6) + locked (4); tap earned badge → share modal
 *   Leaderboard → ward weekly/monthly rankings
 *   Vouchers    → partner discount codes with copy/claim
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, Share, Clipboard, SafeAreaView, StatusBar, Platform,
} from 'react-native';

const NAVY    = '#002B5C';
const GOLD    = '#F5A623';
const GREEN   = '#058541';
const SAFFRON = '#FF9933';

// ── Badge data ─────────────────────────────────────────────────
interface Badge {
  id:     string;
  name:   string;
  emoji:  string;
  desc:   string;
  when?:  string;
  reward?: string;
  earned: boolean;
  hint?:  string;
}

const BADGES: Badge[] = [
  { id: 'firstcrack', name: 'First Crack',     emoji: '🔍', desc: 'First report filed',         earned: true,  when: 'Mar 2025', reward: 'Swiggy ₹20'  },
  { id: 'hattrick',   name: 'Hat Trick',        emoji: '🎩', desc: '3 reports filed',             earned: true,  when: 'Mar 2025', reward: 'Zomato ₹30'  },
  { id: 'guardian',   name: 'Street Guardian',  emoji: '🛡️', desc: '5 reports filed',             earned: true,  when: 'Apr 2025', reward: 'Zomato ₹100' },
  { id: 'cityhero',   name: 'City Hero',        emoji: '⭐', desc: '10 reports filed',            earned: true,  when: 'Apr 2025', reward: 'Swiggy ₹100' },
  { id: 'weekfire',   name: 'Week Warrior',     emoji: '🔥', desc: '7-day reporting streak',      earned: true,  when: 'Apr 2025', reward: 'Swiggy ₹50'  },
  { id: 'zonecap',    name: 'Zone Captain',     emoji: '🏆', desc: 'Top reporter in ward',        earned: true,  when: 'Apr 2025', reward: 'Zomato ₹75'  },
  { id: 'photopro',   name: 'Photo Pro',        emoji: '📸', desc: '5 quality photos',            earned: false, hint: '2 more needed'       },
  { id: 'nightowl',   name: 'Night Owl',        emoji: '🦉', desc: 'Report after 10 PM',          earned: false, hint: 'Report tonight'      },
  { id: 'monsoon',    name: 'Monsoon Watch',    emoji: '🌧️', desc: 'Report during monsoon',       earned: false, hint: 'Jun–Sep only'        },
  { id: 'legend',     name: 'Rasta Legend',     emoji: '👑', desc: '50 reports filed',            earned: false, hint: '39 more to go'       },
];

// ── Leaderboard data ───────────────────────────────────────────
const LEADERBOARD = [
  { rank: 1, name: 'Priya S.',  reports: 9,  pts: 180, you: false },
  { rank: 2, name: 'You',       reports: 7,  pts: 140, you: true  },
  { rank: 3, name: 'Ravi K.',   reports: 5,  pts: 100, you: false },
  { rank: 4, name: 'Sushma D.', reports: 4,  pts:  80, you: false },
  { rank: 5, name: 'Naresh M.', reports: 3,  pts:  60, you: false },
];

// ── Voucher data ───────────────────────────────────────────────
const VOUCHERS = [
  { partner: 'Swiggy', emoji: '🍜', color: '#FC8019', value: '₹20',  code: 'MANA20FC',  expiry: '30 Jun 2025', desc: '₹20 off on orders above ₹99'   },
  { partner: 'Zomato', emoji: '🛵', color: '#E23744', value: '₹30',  code: 'RASTA30HT', expiry: '30 Jun 2025', desc: '₹30 off on your next order'    },
  { partner: 'Zomato', emoji: '🛵', color: '#E23744', value: '₹100', code: 'GHMC100SG', expiry: '31 Jul 2025', desc: '₹100 off on orders above ₹199' },
  { partner: 'Swiggy', emoji: '🍜', color: '#FC8019', value: '₹100', code: 'HERO100CH', expiry: '31 Jul 2025', desc: '₹100 off on orders above ₹299' },
  { partner: 'Swiggy', emoji: '🍜', color: '#FC8019', value: '₹50',  code: 'STREAK50W', expiry: '15 May 2025', desc: '₹50 off — streak bonus'        },
];

type RewardsTab = 'badges' | 'leaderboard' | 'vouchers';

function Tricolour() {
  return (
    <View style={{ flexDirection: 'row', height: 5 }}>
      <View style={{ flex: 1, backgroundColor: SAFFRON }} />
      <View style={{ flex: 1, backgroundColor: '#fff' }} />
      <View style={{ flex: 1, backgroundColor: GREEN }} />
    </View>
  );
}

// ── Badge share modal ──────────────────────────────────────────
function BadgeShareModal({ badge, onClose }: { badge: Badge; onClose: () => void }) {
  const handleShare = async (network?: string) => {
    const message = `I just earned the "${badge.name}" badge on Mana Rasta for helping fix Hyderabad's roads! 🛣️ ${badge.emoji} #ManaRasta #GHMC #Hyderabad https://manarasta.in`;
    try {
      if (!network || network === 'copy') {
        Clipboard.setString(message);
      } else {
        await Share.share({ message, title: `Mana Rasta — ${badge.name}` });
      }
    } catch (_) {}
  };

  const NETWORKS = [
    { id: 'whatsapp',  label: 'WhatsApp',  emoji: '💬', bg: '#dcfce7' },
    { id: 'instagram', label: 'Instagram', emoji: '📸', bg: '#fce7f3' },
    { id: 'facebook',  label: 'Facebook',  emoji: '👤', bg: '#dbeafe' },
    { id: 'linkedin',  label: 'LinkedIn',  emoji: '💼', bg: '#e0f2fe' },
    { id: 'twitter',   label: 'X / Twitter', emoji: '🐦', bg: '#f1f5f9' },
    { id: 'copy',      label: 'Copy link', emoji: '🔗', bg: '#f5f3ff' },
  ];

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.modalSheet} activeOpacity={1}>
          <View style={styles.modalHandle} />

          {/* Badge preview */}
          <View style={styles.badgePreview}>
            <View style={{ flexDirection: 'row', height: 5, marginBottom: 14 }}>
              <View style={{ flex: 1, backgroundColor: SAFFRON }} />
              <View style={{ flex: 1, backgroundColor: '#fff' }} />
              <View style={{ flex: 1, backgroundColor: GREEN }} />
            </View>
            <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: 8 }}>{badge.emoji}</Text>
            <Text style={styles.previewName}>{badge.name}</Text>
            <Text style={styles.previewDesc}>{badge.desc}</Text>
            <Text style={styles.previewWatermark}>🛣️ Mana Rasta · Hyderabad GHMC</Text>
          </View>

          <Text style={styles.shareTitle}>Share your achievement</Text>
          <Text style={styles.shareSubtitle}>Let your network know you're fixing Hyderabad's roads!</Text>

          {/* Network grid */}
          <View style={styles.networkGrid}>
            {NETWORKS.map(n => (
              <TouchableOpacity key={n.id} style={styles.networkBtn} onPress={() => handleShare(n.id)}>
                <View style={[styles.networkIcon, { backgroundColor: n.bg }]}>
                  <Text style={{ fontSize: 20 }}>{n.emoji}</Text>
                </View>
                <Text style={styles.networkLabel}>{n.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Main component ─────────────────────────────────────────────
export default function RewardsScreen() {
  const [tab, setTab]              = useState<RewardsTab>('badges');
  const [shareBadge, setShareBadge] = useState<Badge | null>(null);
  const [claimed, setClaimed]      = useState<Set<string>>(new Set());

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Rewards</Text>
        <Text style={styles.subtitle}>340 pts · Street Guardian 🛡️</Text>
      </View>
      <Tricolour />

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['badges', 'leaderboard', 'vouchers'] as RewardsTab[]).map(t => (
          <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        {/* ── Badges ── */}
        {tab === 'badges' && (
          <>
            <Text style={styles.sectionLabel}>Earned ({BADGES.filter(b => b.earned).length})</Text>
            <View style={styles.badgeGrid}>
              {BADGES.filter(b => b.earned).map(b => (
                <TouchableOpacity key={b.id} style={styles.badgeCard} onPress={() => setShareBadge(b)} activeOpacity={0.85}>
                  <Text style={{ fontSize: 30, marginBottom: 6 }}>{b.emoji}</Text>
                  <Text style={styles.badgeName}>{b.name}</Text>
                  <Text style={styles.badgeDesc}>{b.desc}</Text>
                  <Text style={styles.badgeReward}>🎁 {b.reward}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={styles.badgeWhen}>{b.when}</Text>
                    <View style={styles.sharePill}><Text style={styles.sharePillText}>Share ↗</Text></View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Locked ({BADGES.filter(b => !b.earned).length})</Text>
            <View style={styles.badgeGrid}>
              {BADGES.filter(b => !b.earned).map(b => (
                <View key={b.id} style={[styles.badgeCard, { opacity: 0.55 }]}>
                  <Text style={{ fontSize: 30, marginBottom: 6 }}>{b.emoji}</Text>
                  <Text style={[styles.badgeName, { color: '#6b7280' }]}>{b.name}</Text>
                  <Text style={styles.badgeDesc}>{b.desc}</Text>
                  <Text style={[styles.badgeWhen, { marginTop: 4 }]}>🔒 {b.hint}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Leaderboard ── */}
        {tab === 'leaderboard' && (
          <View style={styles.leaderCard}>
            <View style={styles.leaderHeader}>
              <Text style={styles.leaderHeaderText}>Ward 14 · This week</Text>
            </View>
            {LEADERBOARD.map(r => (
              <View key={r.rank} style={[styles.leaderRow, r.you && styles.leaderRowYou]}>
                <Text style={styles.leaderRank}>
                  {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `#${r.rank}`}
                </Text>
                <Text style={[styles.leaderName, r.you && { fontWeight: '800', color: NAVY }]}>
                  {r.name}{r.you ? ' (you)' : ''}
                </Text>
                <Text style={styles.leaderPts}>{r.pts} pts</Text>
                <Text style={styles.leaderReports}>{r.reports} reports</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Vouchers ── */}
        {tab === 'vouchers' && VOUCHERS.map(v => (
          <View key={v.code} style={styles.voucherCard}>
            <View style={[styles.voucherBar, { backgroundColor: v.color }]} />
            <View style={styles.voucherBody}>
              <View style={styles.voucherTopRow}>
                <Text style={{ fontSize: 20 }}>{v.emoji}</Text>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.voucherTitle, { color: v.color }]}>{v.partner} {v.value}</Text>
                  <Text style={styles.voucherDesc}>{v.desc}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.claimBtn, claimed.has(v.code) && styles.claimBtnClaimed]}
                  onPress={() => { Clipboard.setString(v.code); setClaimed(prev => new Set(prev).add(v.code)); }}
                >
                  <Text style={[styles.claimBtnText, claimed.has(v.code) && { color: '#9ca3af' }]}>
                    {claimed.has(v.code) ? 'Claimed' : 'Copy code'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.codeBox}><Text style={styles.codeText}>{v.code}</Text></View>
              <Text style={styles.voucherExpiry}>Expires {v.expiry}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Share modal */}
      {shareBadge && <BadgeShareModal badge={shareBadge} onClose={() => setShareBadge(null)} />}
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: '#F5F6FA' },
  header:          { backgroundColor: NAVY, padding: 20, paddingTop: 16 },
  title:           { fontSize: 18, fontWeight: '800', color: '#fff' },
  subtitle:        { fontSize: 11, color: 'rgba(255,255,255,.5)', marginTop: 2 },
  tabRow:          { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eef0f4' },
  tabBtn:          { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive:    { borderBottomColor: NAVY },
  tabText:         { fontSize: 12, fontWeight: '700', color: '#9ca3af' },
  tabTextActive:   { color: NAVY },
  scroll:          { flex: 1 },
  sectionLabel:    { fontSize: 12, fontWeight: '700', color: NAVY, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 },
  badgeGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeCard:       { width: '47%', backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#eef0f4', elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  badgeName:       { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 2 },
  badgeDesc:       { fontSize: 10, color: '#8a8fa8', marginBottom: 6 },
  badgeReward:     { fontSize: 10, fontWeight: '600', color: GOLD },
  badgeWhen:       { fontSize: 10, color: '#9ca3af' },
  sharePill:       { backgroundColor: '#EBF0F9', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  sharePillText:   { fontSize: 9, fontWeight: '700', color: NAVY },
  leaderCard:      { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#eef0f4', marginBottom: 16 },
  leaderHeader:    { backgroundColor: '#f9fafb', padding: 12, borderBottomWidth: 1, borderBottomColor: '#eef0f4' },
  leaderHeaderText:{ fontSize: 11, fontWeight: '700', color: NAVY, textTransform: 'uppercase', letterSpacing: 0.5 },
  leaderRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#f5f6fa' },
  leaderRowYou:    { backgroundColor: '#FFF8E7' },
  leaderRank:      { width: 28, textAlign: 'center', fontSize: 14 },
  leaderName:      { flex: 1, fontSize: 13, fontWeight: '500', color: '#374151' },
  leaderPts:       { fontSize: 12, fontWeight: '700', color: NAVY },
  leaderReports:   { fontSize: 11, color: '#8a8fa8', marginLeft: 8 },
  voucherCard:     { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#eef0f4', marginBottom: 10, elevation: 1, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  voucherBar:      { width: 6 },
  voucherBody:     { flex: 1, padding: 14 },
  voucherTopRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  voucherTitle:    { fontSize: 14, fontWeight: '800' },
  voucherDesc:     { fontSize: 11, color: '#8a8fa8' },
  claimBtn:        { backgroundColor: '#EBF0F9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  claimBtnClaimed: { backgroundColor: '#f3f4f6' },
  claimBtnText:    { fontSize: 11, fontWeight: '700', color: NAVY },
  codeBox:         { backgroundColor: '#f9fafb', borderRadius: 8, padding: 8, marginBottom: 4 },
  codeText:        { fontSize: 12, fontWeight: '700', color: '#374151', letterSpacing: 1.5 },
  voucherExpiry:   { fontSize: 10, color: '#9ca3af' },
  // Share modal
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,.55)', justifyContent: 'flex-end' },
  modalSheet:      { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 28 },
  modalHandle:     { width: 36, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  badgePreview:    { backgroundColor: NAVY, borderRadius: 16, padding: 20, marginBottom: 16 },
  previewName:     { color: GOLD, fontWeight: '800', fontSize: 17, textAlign: 'center' },
  previewDesc:     { color: 'rgba(255,255,255,.7)', fontSize: 12, textAlign: 'center', marginTop: 4 },
  previewWatermark:{ color: 'rgba(255,255,255,.4)', fontSize: 10, textAlign: 'center', marginTop: 12 },
  shareTitle:      { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 2 },
  shareSubtitle:   { fontSize: 12, color: '#8a8fa8', marginBottom: 14 },
  networkGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  networkBtn:      { width: '30%', alignItems: 'center', gap: 6, padding: 14, backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: '#eef0f4', borderRadius: 14 },
  networkIcon:     { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  networkLabel:    { fontSize: 11, fontWeight: '600', color: '#374151' },
  closeBtn:        { marginTop: 14, padding: 13, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center' },
  closeBtnText:    { fontSize: 14, fontWeight: '600', color: '#374151' },
});
