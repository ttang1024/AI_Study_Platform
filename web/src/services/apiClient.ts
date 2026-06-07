/// <reference types="vite/client" />
import axios, { AxiosRequestConfig } from 'axios';
import { aiSettingsService } from './aiSettingsService';
import { getApiUrl } from '../utils/env';

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
  const token = localStorage.getItem('sp_access_token') ?? '';
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
  const token = localStorage.getItem('sp_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Only inject AI headers from settings if not already explicitly set on this request
  if (!config.headers['X-AI-Provider']) {
    const provider = aiSettingsService.getActiveProvider();
    const key = aiSettingsService.getActiveKey();
    const model = aiSettingsService.getActiveModel();
    config.headers['X-AI-Provider'] = provider;
    config.headers['X-AI-Model'] = model;
    if (key) {
      config.headers['X-AI-Key'] = key;
    }
  }

  return config;
});

// Response interceptor: handle 401 with token refresh
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: any) => void; reject: (reason?: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    const isLoginRequest = originalRequest.url?.includes('/api/auth/login');

    if (error.response?.status === 401 && !originalRequest._retry && !isLoginRequest) {
      if (typeof window === 'undefined') return Promise.reject(error);
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        }).catch((err) => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // The refresh token lives in an HttpOnly cookie, so it is sent automatically
        // with withCredentials — never read from JavaScript.
        const response = await axios.post(
          `${API_URL}/api/auth/refresh-token`,
          {},
          { withCredentials: true },
        );
        const { accessToken } = response.data.data;

        localStorage.setItem('sp_access_token', accessToken);

        apiClient.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        processQueue(null, accessToken);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('sp_access_token');
        localStorage.removeItem('sp_user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
