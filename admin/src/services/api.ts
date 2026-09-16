import axios from 'axios';
import type { FeedbackItem, FeedbackStatus, FeedbackStats, PaginatedResponse, UserItem, PlatformAnalytics, UserDetail } from '../types';
import { getApiBaseUrl } from '../utils/env';

const http = axios.create({ baseURL: getApiBaseUrl() });

// Attach bearer token from localStorage on every request
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => {
    // Every endpoint here returns JSON. An HTML body means the request never reached the API — an
    // SPA-fallback origin answered it with index.html — and handing that string to a page as if it
    // were the DTO is what turns a routing mistake into a blank screen.
    if (typeof res.data === 'string' && res.data.trimStart().startsWith('<')) {
      return Promise.reject(new Error(`Expected JSON from ${res.config.url} but received an HTML document.`));
    }
    return res;
  },
  // Redirect to login on 401
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_email');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export interface FeedbackListParams {
  page?: number;
  pageSize?: number;
  status?: FeedbackStatus | '';
  type?: string;
  search?: string;
  sort?: 'newest' | 'oldest' | 'rating';
}

export const adminApi = {
  login: async (email: string, password: string) => {
    const { data } = await http.post<{ token: string }>('/admin/auth/login', { email, password });
    // A misrouted /api (an SPA-fallback origin answering with index.html) is a 200 with no token.
    // Treat that as a failed login rather than storing `undefined` and letting the app in.
    if (!data || typeof data.token !== 'string' || !data.token) {
      throw new Error('Login failed: the server did not return a token.');
    }
    return data;
  },

  getFeedbackStats: async (): Promise<FeedbackStats> => {
    const { data } = await http.get<FeedbackStats>('/admin/feedback/stats');
    return data;
  },

  listFeedback: async (params: FeedbackListParams = {}): Promise<PaginatedResponse<FeedbackItem>> => {
    const { data } = await http.get<PaginatedResponse<FeedbackItem>>('/admin/feedback', { params });
    return data;
  },

  getFeedback: async (id: string): Promise<FeedbackItem> => {
    const { data } = await http.get<FeedbackItem>(`/admin/feedback/${id}`);
    return data;
  },

  updateStatus: async (id: string, status: FeedbackStatus): Promise<FeedbackItem> => {
    const { data } = await http.patch<FeedbackItem>(`/admin/feedback/${id}/status`, { status });
    return data;
  },

  saveAdminNote: async (id: string, adminNote: string): Promise<FeedbackItem> => {
    const { data } = await http.patch<FeedbackItem>(`/admin/feedback/${id}/note`, { adminNote });
    return data;
  },

  deleteFeedback: async (id: string): Promise<void> => {
    await http.delete(`/admin/feedback/${id}`);
  },

  listUsers: async (params: { page?: number; pageSize?: number; search?: string; status?: string; sort?: string } = {}): Promise<PaginatedResponse<UserItem>> => {
    const { data } = await http.get<PaginatedResponse<UserItem>>('/admin/users', { params });
    return data;
  },

  setUserActive: async (userId: string, isActive: boolean): Promise<UserItem> => {
    const { data } = await http.patch<UserItem>(`/admin/users/${userId}/active`, { isActive });
    return data;
  },

  getPlatformAnalytics: async (): Promise<PlatformAnalytics> => {
    const { data } = await http.get<PlatformAnalytics>('/admin/analytics');
    return data;
  },

  getUserDetail: async (userId: string): Promise<UserDetail> => {
    const { data } = await http.get<UserDetail>(`/admin/users/${userId}/detail`);
    return data;
  },
};
