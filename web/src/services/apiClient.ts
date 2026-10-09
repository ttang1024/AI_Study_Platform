/// <reference types="vite/client" />
import axios, { AxiosRequestConfig } from 'axios';
import { buildAiHeaders } from '@core/ai';
import { aiSettingsService } from './aiSettingsService';
import { getApiUrl } from '../utils/env';
import { getAccessToken, refreshAccessToken, SessionRejectedError } from './accessToken';

const API_URL = getApiUrl();

// withCredentials lets the browser send/receive the HttpOnly refresh-token cookie.
export const apiClient = axios.create({ baseURL: API_URL, withCredentials: true });

const inflightGetRequests = new Map<string, Promise<any>>();

const normalizeParams = (params: AxiosRequestConfig['params']): string => {
  if (!params) return '';
  if (params instanceof URLSearchParams) return params.toString();
  try {
    return JSON.stringify(params, Object.keys(params).sort());
  } catch {
    return String(params);
  }
};

const getDedupeKey = (url: string, config?: AxiosRequestConfig): string => {
  if (typeof window === 'undefined') return [url, normalizeParams(config?.params), config?.responseType ?? ''].join('|');
  const token = getAccessToken() ?? '';
  return [
    url,
    normalizeParams(config?.params),
    config?.responseType ?? '',
    token,
  ].join('|');
};

const rawGet = apiClient.get.bind(apiClient);
apiClient.get = ((url: string, config?: AxiosRequestConfig) => {
  if (config?.signal?.aborted) return rawGet(url, config);

  const key = getDedupeKey(url, config);
  const pending = inflightGetRequests.get(key);
  if (pending) return pending;

  const request = rawGet(url, config).finally(() => {
    inflightGetRequests.delete(key);
  });
  inflightGetRequests.set(key, request);
  return request;
}) as typeof apiClient.get;

// Request interceptor: attach Bearer token and AI service headers
apiClient.interceptors.request.use((config) => {
  if (typeof window === 'undefined') return config;
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Only inject AI headers from settings if not already explicitly set on this request
  if (!config.headers['X-AI-Provider']) {
    Object.assign(config.headers, buildAiHeaders({
      provider: aiSettingsService.getActiveProvider(),
      model: aiSettingsService.getActiveModel(),
      key: aiSettingsService.getActiveKey() ?? '',
    }));
  }

  return config;
});

// Response interceptor: on 401, mint a new access token from the refresh cookie and retry once.
// refreshAccessToken is single-flight, so a burst of 401s shares one refresh.
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isLoginRequest = originalRequest?.url?.includes('/api/auth/login');

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry || isLoginRequest) {
      return Promise.reject(error);
    }
    if (typeof window === 'undefined') return Promise.reject(error);

    originalRequest._retry = true;
    try {
      const accessToken = await refreshAccessToken();
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      // Only a rejected session signs the user out; a network failure (offline) leaves them signed in.
      if (refreshError instanceof SessionRejectedError) {
        localStorage.removeItem('sp_user');
        window.location.href = '/login';
      }
      return Promise.reject(refreshError);
    }
  }
);
