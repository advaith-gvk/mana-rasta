/**
 * EditProfileScreen.tsx
 * ─────────────────────────────────────────────────────────────
 * Allows the user to update display name, email, and notification
 * preference. Mobile number is locked (verified via OTP at login).
 * Ward / Zone are auto-detected and read-only.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, SafeAreaView, StatusBar, Platform, Alert,
  Switch, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { mobileApi } from '../services/api';

const NAVY  = '#002B5C';
const GOLD  = '#F5A623';
const GREEN = '#058541';

export function EditProfileScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuthStore();

  const [name,          setName]          = useState(user?.name  || '');
  const [email,         setEmail]         = useState(user?.email || '');
  const [notifEnabled,  setNotifEnabled]  = useState(user?.notifications_enabled ?? true);
  const [saving,        setSaving]        = useState(false);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }
    setSaving(true);
    try {
      const updated = await mobileApi.updateProfile({
        name:                   name.trim(),
        email:                  email.trim() || undefined,
        notifications_enabled:  notifEnabled,
      });
      updateUser(updated);
      router.back();
    } catch {
      Alert.alert('Error', 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [name, email, notifEnabled, updateUser, router]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete account',
      'All your reports and points will be permanently deleted. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await mobileApi.deleteAccount();
              router.replace('/login');
            } catch {
              Alert.alert('Error', 'Could not delete account. Please try again.');
            }
          },
        },
      ],
    );
  }, [router]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color={NAVY} size="small" />
            : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
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
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>
              {(name || 'A')[0].toUpperCase()}
            </Text>
            <View style={styles.avatarEditBadge}>
              <Text style={{ fontSize: 10 }}>✏️</Text>
            </View>
          </View>
          <Text style={styles.changePhoto}>Change photo</Text>
        </View>

        {/* Name + Email */}
        <View style={styles.card}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Full Name</Text>
            <TextInput
              style={styles.fieldInput}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="#9ca3af"
              maxLength={60}
            />
          </View>
          <View style={[styles.fieldRow, styles.fieldRowLast]}>
            <Text style={styles.fieldLabel}>Mobile Number</Text>
            <View style={styles.fieldMobileRow}>
              <Text style={styles.fieldMobilePrefix}>+91</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldInputDisabled]}
                value={user?.phone?.replace('+91', '').replace(/(\d{5})(\d{5})/, '$1 $2') || ''}
                editable={false}
              />
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={[styles.fieldRow, styles.fieldRowLast]}>
            <Text style={styles.fieldLabel}>Email (optional)</Text>
            <TextInput
              style={styles.fieldInput}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
              maxLength={120}
            />
          </View>
        </View>

        {/* Ward / Zone — read-only */}
        <View style={styles.card}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Home Ward</Text>
            <View style={styles.fieldReadRow}>
              <Text style={styles.fieldReadValue}>
                {user?.ward_name ? `Ward ${user.ward_id} · ${user.ward_name}` : 'Auto-detected'}
              </Text>
              <Text style={styles.fieldReadHint}>Auto-detected</Text>
            </View>
          </View>
          <View style={[styles.fieldRow, styles.fieldRowLast]}>
            <Text style={styles.fieldLabel}>Zone</Text>
            <Text style={styles.fieldReadValue}>{user?.zone_name || 'Kukatpally Zone'}</Text>
          </View>
        </View>

        {/* Notifications toggle */}
        <View style={styles.card}>
          <View style={[styles.fieldRow, styles.fieldRowLast, { alignItems: 'center' }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Report status updates</Text>
              <Text style={styles.toggleSub}>Notify when GHMC updates your report</Text>
            </View>
            <Switch
              value={notifEnabled}
              onValueChange={setNotifEnabled}
              trackColor={{ false: '#d1d5db', true: NAVY }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Delete account */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount} activeOpacity={0.7}>
          <Text style={styles.deleteBtnText}>Delete account</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

export default EditProfileScreen;

const styles = StyleSheet.create({
  safe:               { flex: 1, backgroundColor: NAVY },
  scroll:             { flex: 1, backgroundColor: '#F8F9FA' },
  scrollContent:      { padding: 20, paddingBottom: 40 },

  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        paddingHorizontal: 16,
                        paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 14,
                        backgroundColor: NAVY },
  backBtn:            { width: 40, height: 40, justifyContent: 'center' },
  backArrow:          { color: '#fff', fontSize: 22, fontWeight: '300' },
  headerTitle:        { color: '#fff', fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center', marginLeft: -40 },
  saveBtn:            { backgroundColor: GOLD, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 7 },
  saveBtnDisabled:    { opacity: 0.5 },
  saveBtnText:        { color: NAVY, fontSize: 13, fontWeight: '800' },

  tricolour:          { flexDirection: 'row', height: 9 },
  stripe:             { flex: 1 },

  avatarRow:          { alignItems: 'center', marginBottom: 24, gap: 10 },
  avatar:             { width: 80, height: 80, borderRadius: 40,
                        backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center',
                        position: 'relative' },
  avatarInitial:      { fontSize: 32, fontWeight: '800', color: NAVY },
  avatarEditBadge:    { position: 'absolute', bottom: 0, right: 0,
                        backgroundColor: NAVY, borderRadius: 12, width: 24, height: 24,
                        alignItems: 'center', justifyContent: 'center',
                        borderWidth: 2, borderColor: '#fff' },
  changePhoto:        { fontSize: 13, color: GOLD, fontWeight: '700' },

  card:               { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
                        borderWidth: 1, borderColor: '#eef0f4', marginBottom: 14 },
  fieldRow:           { padding: 14, borderBottomWidth: 1, borderBottomColor: '#f5f6fa' },
  fieldRowLast:       { borderBottomWidth: 0 },
  fieldLabel:         { fontSize: 10, fontWeight: '700', color: '#8a8fa8',
                        textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  fieldInput:         { fontSize: 15, fontWeight: '500', color: '#111827', padding: 0 },
  fieldInputDisabled: { color: '#9ca3af' },
  fieldMobileRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fieldMobilePrefix:  { fontSize: 15, color: '#9ca3af' },
  verifiedBadge:      { backgroundColor: '#EDF7ED', borderRadius: 6,
                        paddingHorizontal: 8, paddingVertical: 3 },
  verifiedText:       { fontSize: 10, fontWeight: '700', color: GREEN },
  fieldReadRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldReadValue:     { fontSize: 15, fontWeight: '500', color: '#111827' },
  fieldReadHint:      { fontSize: 11, color: '#9ca3af' },

  toggleTitle:        { fontSize: 14, fontWeight: '500', color: '#111827' },
  toggleSub:          { fontSize: 12, color: '#9ca3af', marginTop: 2 },

  deleteBtn:          { alignItems: 'center', paddingVertical: 14 },
  deleteBtnText:      { fontSize: 13, color: '#EF4444', fontWeight: '600' },
});
