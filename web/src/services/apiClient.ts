/// <reference types="vite/client" />
import axios from 'axios';
import { aiSettingsService } from './aiSettingsService';

const API_URL = import.meta.env.VITE_API_URL ?? '';

export const apiClient = axios.create({ baseURL: API_URL });

// Request interceptor: attach Bearer token and AI service headers
apiClient.interceptors.request.use((config) => {
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

      const refreshToken = localStorage.getItem('sp_refresh_token');

      if (!refreshToken) {
        isRefreshing = false;
        localStorage.removeItem('sp_access_token');
        localStorage.removeItem('sp_refresh_token');
        localStorage.removeItem('sp_user');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_URL}/api/auth/refresh-token`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;

        localStorage.setItem('sp_access_token', accessToken);
        if (newRefreshToken) {
          localStorage.setItem('sp_refresh_token', newRefreshToken);
        }

        apiClient.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        processQueue(null, accessToken);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('sp_access_token');
        localStorage.removeItem('sp_refresh_token');
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
