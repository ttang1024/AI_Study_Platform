import axios from 'axios';

import { buildAiHeaders, needsAiHeaders } from '@core/ai';
import { jwtExpiresWithin } from '@core/jwt';
import { timeZoneHeaders } from '@core/timeZone';
import { API_URL } from '@/constants/env';
import { aiSettingsService } from '@/services/aiSettingsService';
import { tokenStore } from '@/services/tokenStore';

// axios's type declarations expose only `export default axios`. The `create` the lint rule detects
// is a runtime property of the CJS object, not an importable named export, so `import { create }`
// would not typecheck — `axios.create` is the only correct form here.
// eslint-disable-next-line import/no-named-as-default-member
export const apiClient = axios.create({ baseURL: API_URL });

// AuthContext registers this so a failed silent refresh (e.g. expired/revoked
// refresh token) can clear the signed-in user without this module importing
// context/navigation directly.
let onSessionExpired: (() => void) | null = null;
export const setOnSessionExpired = (fn: (() => void) | null) => {
  onSessionExpired = fn;
};

// Native clients have no HttpOnly cookie jar — the backend detects this header
// and returns the refresh token in the response body instead of a cookie
// (see server/StudyPlatform.API/Controllers/AuthController.cs `IsMobileClient`).
apiClient.defaults.headers.common['X-Client-Type'] = 'mobile';
Object.assign(apiClient.defaults.headers.common, timeZoneHeaders());

apiClient.interceptors.request.use(async (config) => {
  const token = await tokenStore.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Only inject AI headers from settings if not already explicitly set on this request
  // (see AiServicesTab's test-connection call, which sets its own), and only on requests that can run
  // AI work — the provider key stays off plain reads.
  if (!config.headers['X-AI-Provider'] && needsAiHeaders(config.method, config.url)) {
    const [provider, key, model] = await Promise.all([
      aiSettingsService.getActiveProvider(),
      aiSettingsService.getActiveKey(),
      aiSettingsService.getActiveModel(),
    ]);
    Object.assign(config.headers, buildAiHeaders({ provider, model, key: key ?? '' }));
  }

  return config;
});

let inflightRefresh: Promise<string> | null = null;
let lastSessionExpiry: unknown = null;

/**
 * Mints a new access token from the stored refresh token. Single-flight: concurrent callers share one
 * request — each refresh rotates the refresh token, so two in parallel would race, and the loser's
 * rejected token would sign the user out. Shared by the 401 interceptor and the chat hub.
 */
function refreshSession(): Promise<string> {
  if (!inflightRefresh) {
    inflightRefresh = (async () => {
      const refreshToken = await tokenStore.getRefreshToken();
      if (!refreshToken) throw new Error('No refresh token');

      const response = await axios.post(
        `${API_URL}/api/auth/refresh-token`,
        { refreshToken },
        { headers: { 'X-Client-Type': 'mobile', ...timeZoneHeaders() } },
      );
      const { accessToken, refreshToken: newRefreshToken } = response.data.data;

      await tokenStore.setAccessToken(accessToken);
      await tokenStore.setRefreshToken(newRefreshToken);
      apiClient.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
      return accessToken as string;
    })().finally(() => {
      inflightRefresh = null;
    });
  }
  return inflightRefresh;
}

/**
 * The stored token if it has at least `marginSeconds` left, otherwise a freshly minted one. For the chat
 * hub, which reconnects with whatever this returns and cannot retry a 401 itself; the server closes hub
 * connections when their token expires. Null when no session can be established.
 */
export async function ensureFreshAccessToken(marginSeconds = 30): Promise<string | null> {
  const token = await tokenStore.getAccessToken();
  if (token && !jwtExpiresWithin(token, marginSeconds)) return token;
  try {
    return await refreshSession();
  } catch {
    return null;
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isLoginRequest = originalRequest?.url?.includes('/api/auth/login');

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isLoginRequest) {
      originalRequest._retry = true;

      try {
        const accessToken = await refreshSession();
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Concurrent 401s share one refresh and so one rejection: sign out once, not once per request.
        if (refreshError !== lastSessionExpiry) {
          lastSessionExpiry = refreshError;
          await tokenStore.clear();
          onSessionExpired?.();
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);
