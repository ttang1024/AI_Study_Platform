// Service logic moved to the shared package (packages/core) — web/ had the same
// endpoints and the same user mapping. This shim wires the RN HTTP adapter into
// the shared factory and keeps rn's method names and its refreshToken-carrying
// result shape (a native app has no cookie jar, so it stores the token itself).
import { createAuthService, type AuthUser } from '@core/services/authService';
import { http } from '@/services/http';

const core = createAuthService(http);

export type User = AuthUser;

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: User;
}

const toRnResult = ({ accessToken, refreshToken, user }: Awaited<ReturnType<typeof core.login>>): LoginResult => ({
  accessToken,
  refreshToken,
  user,
});

export const authService = {
  sendOtp: core.sendOtp,

  register: core.register,

  async login(email: string, password: string): Promise<LoginResult> {
    return toRnResult(await core.login(email, password));
  },

  async oauthLogin(provider: 'google' | 'github', code: string, redirectUri: string): Promise<LoginResult> {
    return toRnResult(await core.loginWithOAuth(provider, code, redirectUri));
  },

  resetPassword: core.resetPassword,

  changePassword: core.changePassword,

  updateProfile: core.updateProfile,

  logout(refreshToken: string | null): Promise<void> {
    return core.logout(refreshToken);
  },
};
