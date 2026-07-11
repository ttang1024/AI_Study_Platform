import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { authService, type User } from '@/services/authService';
import { setOnSessionExpired } from '@/services/apiClient';
import { tokenStore } from '@/services/tokenStore';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithOAuth: (provider: 'google' | 'github', code: string, redirectUri: string) => Promise<void>;
  register: (data: { email: string; fullName: string; password: string; otpCode: string }) => Promise<void>;
  sendOtp: (email: string, purpose: 'registration' | 'passwordReset') => Promise<void>;
  resetPassword: (data: { email: string; otpCode: string; newPassword: string }) => Promise<void>;
  updateProfile: (data: { fullName: string }) => Promise<void>;
  changePassword: (data: { currentPassword: string; newPassword: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    tokenStore.getUser().then((savedUser) => {
      setUser(savedUser);
      setIsLoading(false);
    });

    setOnSessionExpired(() => setUser(null));
    return () => setOnSessionExpired(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken, refreshToken, user: apiUser } = await authService.login(email, password);
    await tokenStore.setAccessToken(accessToken);
    await tokenStore.setRefreshToken(refreshToken);
    await tokenStore.setUser(apiUser);
    setUser(apiUser);
  }, []);

  const loginWithOAuth = useCallback(async (provider: 'google' | 'github', code: string, redirectUri: string) => {
    const { accessToken, refreshToken, user: apiUser } = await authService.oauthLogin(provider, code, redirectUri);
    await tokenStore.setAccessToken(accessToken);
    await tokenStore.setRefreshToken(refreshToken);
    await tokenStore.setUser(apiUser);
    setUser(apiUser);
  }, []);

  const register = useCallback(async (data: { email: string; fullName: string; password: string; otpCode: string }) => {
    await authService.register(data);
    await login(data.email, data.password);
  }, [login]);

  const sendOtp = useCallback(
    (email: string, purpose: 'registration' | 'passwordReset') => authService.sendOtp(email, purpose),
    [],
  );

  const resetPassword = useCallback(
    (data: { email: string; otpCode: string; newPassword: string }) => authService.resetPassword(data),
    [],
  );

  const updateProfile = useCallback(async (data: { fullName: string }) => {
    await authService.updateProfile(data);
    setUser((prev) => {
      const updated = { ...prev!, name: data.fullName };
      tokenStore.setUser(updated);
      return updated;
    });
  }, []);

  const changePassword = useCallback(
    (data: { currentPassword: string; newPassword: string }) => authService.changePassword(data),
    [],
  );

  const logout = useCallback(async () => {
    try {
      const refreshToken = await tokenStore.getRefreshToken();
      await authService.logout(refreshToken);
    } catch {
      // Clear local state regardless of whether the server call succeeded.
    } finally {
      await tokenStore.clear();
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      loginWithOAuth,
      register,
      sendOtp,
      resetPassword,
      updateProfile,
      changePassword,
      logout,
    }),
    [user, isLoading, login, loginWithOAuth, register, sendOtp, resetPassword, updateProfile, changePassword, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
