import type { HttpClient } from '../http';

/**
 * The whole auth surface, identical on web and rn — the two apps differed only
 * in what they kept from the login response (web reads `expiresAt` and lets the
 * HttpOnly refresh cookie do the rest; rn stores the `refreshToken` itself,
 * since a native app has no cookie jar). So the factory returns the mapped user
 * plus the full token set and each app takes the fields it stores.
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

/** The `/api/auth/*` login-shaped response, before mapping. */
interface AuthResponseData {
  userId: string;
  email: string;
  fullName: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  accessTokenExpiry?: string;
  twoFactorRequired?: boolean;
  challengeToken?: string | null;
}

export interface LoginResult {
  accessToken: string;
  /** Present for native clients; web relies on the HttpOnly refresh cookie instead. */
  refreshToken: string;
  /** ISO expiry of the access token, when the server sends one. */
  expiresAt: string;
  user: AuthUser;
  /**
   * True when the password leg passed but a second factor is still owed. The token fields are
   * empty in that case and {@link challengeToken} is what the code leg is redeemed with — so a
   * caller that stores `accessToken` without checking this ends up with a blank token and a
   * failing next request, rather than a session it should not have.
   */
  twoFactorRequired: boolean;
  challengeToken: string | null;
}

export interface RegisterPayload {
  email: string;
  fullName: string;
  password: string;
  otpCode: string;
}

export interface ResetPasswordPayload {
  email: string;
  otpCode: string;
  newPassword: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export type OtpPurpose = 'registration' | 'passwordReset';

const mapAuthResponse = (d: AuthResponseData): LoginResult => ({
  accessToken: d.accessToken,
  refreshToken: d.refreshToken ?? '',
  expiresAt: d.expiresAt ?? d.accessTokenExpiry ?? '',
  user: { id: d.userId, email: d.email, name: d.fullName },
  twoFactorRequired: d.twoFactorRequired ?? false,
  challengeToken: d.challengeToken ?? null,
});

export function createAuthService(http: HttpClient) {
  const postAuth = async (url: string, body: unknown): Promise<LoginResult> => {
    const res = await http.post<{ data: AuthResponseData }>(url, body);
    return mapAuthResponse(res.data.data);
  };

  return {
    async sendOtp(email: string, purpose: OtpPurpose): Promise<void> {
      await http.post('/api/auth/send-otp', { email, purpose });
    },

    async register(data: RegisterPayload): Promise<void> {
      await http.post('/api/auth/register', data);
    },

    login(email: string, password: string): Promise<LoginResult> {
      return postAuth('/api/auth/login', { email, password });
    },

    /**
     * Second leg of a two-factor login. `code` is either a TOTP code or a recovery code — the
     * server works out which, so the UI needs one field rather than a mode switch.
     */
    verifyTwoFactor(challengeToken: string, code: string): Promise<LoginResult> {
      return postAuth('/api/auth/2fa/verify', { challengeToken, code });
    },

    loginWithOAuth(provider: string, code: string, redirectUri: string): Promise<LoginResult> {
      return postAuth('/api/auth/oauth', { provider, code, redirectUri });
    },

    /** Google One Tap / Sign-In credential (web only today, but the endpoint is platform-neutral). */
    loginWithGoogleCredential(credential: string): Promise<LoginResult> {
      return postAuth('/api/auth/google-credential', { credential });
    },

    /**
     * Web sends nothing — the refresh token rides along as an HttpOnly cookie.
     * Native passes its stored token explicitly.
     */
    async refreshToken(refreshToken?: string | null): Promise<{ accessToken: string }> {
      const res = await http.post<{ data: { accessToken: string } }>(
        '/api/auth/refresh-token',
        refreshToken ? { refreshToken } : {},
      );
      return res.data.data;
    },

    async resetPassword(data: ResetPasswordPayload): Promise<void> {
      await http.post('/api/auth/reset-password', data);
    },

    async changePassword(data: ChangePasswordPayload): Promise<void> {
      await http.post('/api/auth/change-password', data);
    },

    async updateProfile(data: { fullName: string }): Promise<void> {
      await http.put('/api/auth/update-profile', data);
    },

    /** Same asymmetry as refresh: the cookie carries it on web, the body on native. */
    async logout(refreshToken?: string | null): Promise<void> {
      await http.post('/api/auth/logout', refreshToken !== undefined ? { refreshToken } : {});
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
