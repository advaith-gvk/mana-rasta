// src/services/api.ts
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.potholes.hyderabad.gov.in/api/v1';

const api = axios.create({ baseURL: BASE_URL, timeout: 15000 });

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const fp = await SecureStore.getItemAsync('device_fingerprint');
  if (fp) config.headers['x-device-fingerprint'] = fp;

  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await SecureStore.deleteItemAsync('auth_token');
      // Navigation reset is handled by the auth store listener
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Citizen API helpers ──────────────────────────────────────

export const mobileApi = {
  // Auth
  sendOtp: (phone: string) =>
    api.post('/auth/send-otp', { phone }).then(r => r.data),

  verifyOtp: (body: Record<string, string>) =>
    api.post('/auth/verify-otp', body).then(r => r.data),

  getMe: () =>
    api.get('/auth/me').then(r => r.data),

  updateProfile: (body: Record<string, unknown>) =>
    api.patch('/auth/profile', body).then(r => r.data),

  // Reports
  submitReport: (formData: FormData) =>
    api.post('/reports', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data),

  getMyReports: (params?: Record<string, unknown>) =>
    api.get('/reports', { params }).then(r => r.data),

  getReport: (id: string) =>
    api.get(`/reports/${id}`).then(r => r.data),

  getNearbyReports: (lat: number, lng: number, radiusM = 1000) =>
    api.get('/reports/nearby', { params: { lat, lng, radiusM } }).then(r => r.data),

  acknowledgeReport: (id: string, note?: string) =>
    api.post(`/reports/${id}/acknowledge`, { note }).then(r => r.data),

  // Geo
  resolveLocation: (lat: number, lng: number) =>
    api.get('/geo/resolve', { params: { lat, lng } }).then(r => r.data),

  // Rewards
  getWallet: () =>
    api.get('/rewards/wallet').then(r => r.data),

  getBadges: () =>
    api.get('/rewards/badges').then(r => r.data),

  getLeaderboard: (period = 'weekly') =>
    api.get('/rewards/leaderboard', { params: { period } }).then(r => r.data),

  getCatalog: () =>
    api.get('/rewards/catalog').then(r => r.data),

  redeem: (catalogId: string) =>
    api.post('/rewards/redeem', { catalogId }).then(r => r.data),

  // Citizen fix confirmation
  confirmFix: (reportId: string) =>
    api.post(`/reports/${reportId}/confirm-fix`).then(r => r.data),
};
