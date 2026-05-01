import React, { createContext, useCallback, useContext, useState } from 'react';
import { adminApi } from '../services/api';

interface AuthContextValue {
  email: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [email, setEmail] = useState<string | null>(() => localStorage.getItem('admin_email'));

  const login = useCallback(async (email: string, password: string) => {
    const { token } = await adminApi.login(email, password);
    localStorage.setItem('admin_token', token);
    localStorage.setItem('admin_email', email);
    setEmail(email);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_email');
    setEmail(null);
  }, []);

  return (
    <AuthContext.Provider value={{ email, isAuthenticated: !!email, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
