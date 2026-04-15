// services/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Admin API helpers ────────────────────────────────────────

export const adminApi = {
  // Reports
  getQueue: (params: Record<string, unknown>) =>
    api.get('/admin/reports', { params }).then(r => r.data),

  getReport: (id: string) =>
    api.get(`/reports/${id}`).then(r => r.data),

  updateStatus: (id: string, body: Record<string, unknown>) =>
    api.patch(`/admin/reports/${id}/status`, body).then(r => r.data),

  // Fraud
  getFraud: (params?: Record<string, unknown>) =>
    api.get('/admin/fraud', { params }).then(r => r.data),

  banUser: (id: string, body: Record<string, unknown>) =>
    api.post(`/admin/users/${id}/ban`, body).then(r => r.data),

  banDevice: (fp: string, body: Record<string, unknown>) =>
    api.post(`/admin/devices/${fp}/ban`, body).then(r => r.data),

  // SLA
  getSLA: () =>
    api.get('/admin/sla').then(r => r.data),

  // Analytics
  getAnalytics: (days = 30) =>
    api.get('/admin/analytics', { params: { days } }).then(r => r.data),

  getTrend: (days = 30) =>
    api.get('/analytics/reports/trend', { params: { days } }).then(r => r.data),

  getZoneSummary: () =>
    api.get('/analytics/zones/summary').then(r => r.data),

  // Geo
  getViewport: (params: Record<string, unknown>) =>
    api.get('/geo/viewport', { params }).then(r => r.data),

  getWards: (zoneId?: string) =>
    api.get('/geo/wards', { params: zoneId ? { zoneId } : {} }).then(r => r.data),

  // Leaderboard
  getLeaderboard: (period = 'weekly') =>
    api.get('/rewards/leaderboard', { params: { period, limit: 100 } }).then(r => r.data),

  // Officers
  getOfficers: (params?: Record<string, unknown>) =>
    api.get('/admin/officers', { params }).then(r => r.data),

  getOfficerPerformance: (params?: Record<string, unknown>) =>
    api.get('/admin/officers/performance', { params }).then(r => r.data),

  refreshPerformance: () =>
    api.post('/admin/performance/refresh').then(r => r.data),

  // SLA heatmap
  getSLAHeatmap: () =>
    api.get('/admin/sla/heatmap').then(r => r.data),

  // CSV export
  exportCSV: () => {
    const token = localStorage.getItem('admin_token');
    window.open(
      `${import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1'}/analytics/csv?token=${token}`
    );
  },
};
