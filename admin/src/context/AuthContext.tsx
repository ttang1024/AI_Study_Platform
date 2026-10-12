import React, { createContext, useCallback, useContext, useState } from 'react';
import { adminApi } from '../services/api';
import { adminSession } from '../services/adminSession';

interface AuthContextValue {
  email: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// The token is what the API actually authenticates with, so it — not the remembered email — decides
// whether this browser is signed in. Keeping the email as the source of truth let a session with no
// usable token through to the protected routes, where every request then 401s.
const readSession = () => adminSession.getEmail();

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [email, setEmail] = useState<string | null>(readSession);

  const login = useCallback(async (email: string, password: string) => {
    const { token } = await adminApi.login(email, password);
    adminSession.save(token, email);
    setEmail(email);
  }, []);

  const logout = useCallback(() => {
    adminSession.clear();
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
