import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuthStore } from '../../src/store/authStore';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  return (
    <View style={s.container}>
      <View style={s.topBar}>
        <Text style={s.title}>Profile</Text>
        <Text style={s.zone}>{user?.zone_name || 'Khairatabad'} Zone</Text>
      </View>
      <View style={[s.stripe, { backgroundColor: '#FF9933' }]} />
      <View style={[s.stripe, { backgroundColor: '#fff' }]} />
      <View style={[s.stripe, { backgroundColor: '#058541' }]} />
      <View style={s.body}>
        <Text style={s.name}>{user?.name || 'Citizen'}</Text>
        <Text style={s.phone}>{user?.phone}</Text>
        <TouchableOpacity style={s.logoutBtn} onPress={logout}>
          <Text style={s.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  topBar:    { backgroundColor: '#002B5C', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12 },
  title:     { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: 'Georgia' },
  zone:      { color: 'rgba(255,255,255,0.55)', fontSize: 9, marginTop: 2, letterSpacing: 1, textTransform: 'uppercase' },
  stripe:    { height: 1 },
  body:      { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  name:      { fontSize: 20, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  phone:     { fontSize: 14, color: '#888', marginBottom: 32 },
  logoutBtn: { backgroundColor: '#002B5C', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 32 },
  logoutText:{ color: '#fff', fontWeight: '700', fontSize: 14 },
});
