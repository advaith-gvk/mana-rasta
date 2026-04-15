import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

interface AuthUser {
  id: string;
  name: string;
  role: string;
  email: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      api.get('/auth/me').then(r => setUser(r.data)).catch(() => {
        localStorage.removeItem('admin_token');
      });
    }
  }, []);

  async function login(email: string, password: string) {
    // Admin login via email/password (different from citizen OTP flow)
    const { data } = await api.post('/auth/admin-login', { email, password });
    localStorage.setItem('admin_token', data.token);
    setUser(data.user);
  }

  function logout() {
    localStorage.removeItem('admin_token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
