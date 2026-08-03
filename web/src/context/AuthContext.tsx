import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { authService } from '../services/authService';

/**
 * What `login` resolves to. `pending2fa` means the password was right but a code is still owed —
 * the caller shows the code form and finishes with `verifyTwoFactor`.
 */
export type LoginOutcome =
  | { status: 'signedIn' }
  | { status: 'pending2fa'; challengeToken: string };

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<LoginOutcome>;
  verifyTwoFactor: (challengeToken: string, code: string) => Promise<void>;
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

  /**
   * Stores a session from a completed login. Shared by the one-leg and two-leg paths so both end
   * up in exactly the same state.
   */
  const establishSession = (result: { accessToken: string; user: User }) => {
    localStorage.setItem('sp_access_token', result.accessToken);
    localStorage.setItem('sp_user', JSON.stringify(result.user));
    setUser(result.user);
  };

  const login = async (email: string, password: string): Promise<LoginOutcome> => {
    const result = await authService.login(email, password);

    // Nothing is stored on this branch: the server issued no tokens, only a challenge.
    if (result.twoFactorRequired && result.challengeToken) {
      return { status: 'pending2fa', challengeToken: result.challengeToken };
    }

    establishSession(result);
    return { status: 'signedIn' };
  };

  const verifyTwoFactor = async (challengeToken: string, code: string): Promise<void> => {
    establishSession(await authService.verifyTwoFactor(challengeToken, code));
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
    <AuthContext.Provider value={{ user, login, verifyTwoFactor, loginWithOAuth, loginWithGoogleCredential, logout, register, sendOtp, resetPassword, updateProfile, changePassword, isAuthenticated: !!user, isLoading }}>
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
