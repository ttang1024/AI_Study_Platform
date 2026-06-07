import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { authService } from '../services/authService';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithOAuth: (provider: string, code: string, redirectUri: string) => Promise<void>;
  loginWithGoogleCredential: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: { email: string; fullName: string; password: string; otpCode: string }) => Promise<void>;
  sendOtp: (email: string, purpose: 'registration' | 'passwordReset') => Promise<void>;
  resetPassword: (data: { email: string; otpCode: string; newPassword: string }) => Promise<void>;
  updateProfile: (data: { fullName: string }) => Promise<void>;
  changePassword: (data: { currentPassword: string; newPassword: string }) => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('sp_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('sp_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    const { accessToken, user: apiUser } = await authService.login(email, password);
    localStorage.setItem('sp_access_token', accessToken);
    localStorage.setItem('sp_user', JSON.stringify(apiUser));
    setUser(apiUser);
  };

  const logout = async (): Promise<void> => {
    try {
      // The refresh token is in an HttpOnly cookie; the server reads and revokes it.
      await authService.logout();
    } catch {
      // Ignore errors on logout — clear local state regardless
    } finally {
      localStorage.removeItem('sp_access_token');
      localStorage.removeItem('sp_user');
      setUser(null);
    }
  };

  const register = async (data: { email: string; fullName: string; password: string; otpCode: string }): Promise<void> => {
    await authService.register(data);
    // Auto-login after registration
    await login(data.email, data.password);
  };

  const sendOtp = async (email: string, purpose: 'registration' | 'passwordReset'): Promise<void> => {
    await authService.sendOtp(email, purpose);
  };

  const resetPassword = async (data: { email: string; otpCode: string; newPassword: string }): Promise<void> => {
    await authService.resetPassword(data);
  };

  const updateProfile = async (data: { fullName: string }): Promise<void> => {
    await authService.updateProfile(data);
    const updatedUser = { ...user!, name: data.fullName };
    localStorage.setItem('sp_user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  const loginWithOAuth = async (provider: string, code: string, redirectUri: string): Promise<void> => {
    const { accessToken, user: apiUser } = await authService.loginWithOAuth(provider, code, redirectUri);
    localStorage.setItem('sp_access_token', accessToken);
    localStorage.setItem('sp_user', JSON.stringify(apiUser));
    setUser(apiUser);
  };

  const loginWithGoogleCredential = async (credential: string): Promise<void> => {
    const { accessToken, user: apiUser } = await authService.loginWithGoogleCredential(credential);
    localStorage.setItem('sp_access_token', accessToken);
    localStorage.setItem('sp_user', JSON.stringify(apiUser));
    setUser(apiUser);
  };

  const changePassword = async (data: { currentPassword: string; newPassword: string }): Promise<void> => {
    await authService.changePassword(data);
  };

  return (
    <AuthContext.Provider value={{ user, login, loginWithOAuth, loginWithGoogleCredential, logout, register, sendOtp, resetPassword, updateProfile, changePassword, isAuthenticated: !!user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const useOptionalAuth = () => useContext(AuthContext);
