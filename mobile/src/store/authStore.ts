import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { mobileApi } from '../services/api';

interface User {
  id: string;
  name: string;
  phone: string;
  role: string;
  points_balance: number;
  streak_days: number;
  total_reports: number;
  zone_name: string;
  fixed_reports: number;
  open_nearby: number;
  open_reports: number;
}

interface AuthState {
  user:            User | null;
  token:           string | null;
  isAuthenticated: boolean;
  isLoading:       boolean;
  setToken:        (token: string) => Promise<void>;
  loadUser:        () => Promise<void>;
  logout:          () => Promise<void>;
  updateUser:      (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user:            null,
  token:           null,
  isAuthenticated: false,
  isLoading:       true,

  setToken: async (token: string) => {
    await SecureStore.setItemAsync('auth_token', token);
    set({ token, isAuthenticated: true });
    await get().loadUser();
  },

  loadUser: async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      if (!token) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }
      set({ token });
      const user = await mobileApi.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      await SecureStore.deleteItemAsync('auth_token');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('auth_token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  updateUser: (updates) => {
    set(state => ({ user: state.user ? { ...state.user, ...updates } : null }));
  },
}));
