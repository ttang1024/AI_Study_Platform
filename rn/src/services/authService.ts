import { apiClient } from '@/services/apiClient';

export interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthResponseData {
  userId: string;
  email: string;
  fullName: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: User;
}

const mapAuthResponse = (d: AuthResponseData): LoginResult => ({
  accessToken: d.accessToken,
  refreshToken: d.refreshToken,
  user: { id: d.userId, email: d.email, name: d.fullName },
});

export const authService = {
  async sendOtp(email: string, purpose: 'registration' | 'passwordReset'): Promise<void> {
    await apiClient.post('/api/auth/send-otp', { email, purpose });
  },

  async register(data: { email: string; fullName: string; password: string; otpCode: string }): Promise<void> {
    await apiClient.post('/api/auth/register', data);
  },

  async login(email: string, password: string): Promise<LoginResult> {
    const response = await apiClient.post('/api/auth/login', { email, password });
    return mapAuthResponse(response.data.data);
  },

  async oauthLogin(provider: 'google' | 'github', code: string, redirectUri: string): Promise<LoginResult> {
    const response = await apiClient.post('/api/auth/oauth', { provider, code, redirectUri });
    return mapAuthResponse(response.data.data);
  },

  async resetPassword(data: { email: string; otpCode: string; newPassword: string }): Promise<void> {
    await apiClient.post('/api/auth/reset-password', data);
  },

  async changePassword(data: { currentPassword: string; newPassword: string }): Promise<void> {
    await apiClient.post('/api/auth/change-password', data);
  },

  async updateProfile(data: { fullName: string }): Promise<void> {
    await apiClient.put('/api/auth/update-profile', data);
  },

  async logout(refreshToken: string | null): Promise<void> {
    await apiClient.post('/api/auth/logout', { refreshToken });
  },
};
