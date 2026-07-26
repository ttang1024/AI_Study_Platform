import axios from 'axios';

import { buildAiHeaders } from '@core/ai';
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

apiClient.interceptors.request.use(async (config) => {
  const token = await tokenStore.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Only inject AI headers from settings if not already explicitly set on this request
  // (see AiServicesTab's test-connection call, which sets its own).
  if (!config.headers['X-AI-Provider']) {
    const [provider, key, model] = await Promise.all([
      aiSettingsService.getActiveProvider(),
      aiSettingsService.getActiveKey(),
      aiSettingsService.getActiveModel(),
    ]);
    Object.assign(config.headers, buildAiHeaders({ provider, model, key: key ?? '' }));
  }

  return config;
});

let isRefreshing = false;
let failedQueue: { resolve: (token: string) => void; reject: (reason?: unknown) => void }[] = [];

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isLoginRequest = originalRequest?.url?.includes('/api/auth/login');

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isLoginRequest) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await tokenStore.getRefreshToken();
        if (!refreshToken) throw error;

        const response = await axios.post(
          `${API_URL}/api/auth/refresh-token`,
          { refreshToken },
          { headers: { 'X-Client-Type': 'mobile' } },
        );
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;

        await tokenStore.setAccessToken(accessToken);
        await tokenStore.setRefreshToken(newRefreshToken);

        apiClient.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        processQueue(null, accessToken);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await tokenStore.clear();
        onSessionExpired?.();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
