import type { HttpClient } from '@core/http';
import { apiClient } from './apiClient';

/**
 * Adapts the web axios instance (Bearer token from localStorage, AI headers,
 * in-flight GET dedupe, silent refresh) to the platform-agnostic HttpClient the
 * shared services in @study/core are written against.
 */
// Forward `config`/`body` only when provided so the underlying call arity matches
// the pre-shared services (e.g. `apiClient.post(url)` with no trailing undefined).
export const http: HttpClient = {
  get: (url, config) => (config ? apiClient.get(url, config) : apiClient.get(url)),
  post: (url, body, config) =>
    config ? apiClient.post(url, body, config) : body !== undefined ? apiClient.post(url, body) : apiClient.post(url),
  put: (url, body, config) =>
    config ? apiClient.put(url, body, config) : body !== undefined ? apiClient.put(url, body) : apiClient.put(url),
  patch: (url, body, config) =>
    config ? apiClient.patch(url, body, config) : body !== undefined ? apiClient.patch(url, body) : apiClient.patch(url),
  delete: (url, config) => (config ? apiClient.delete(url, config) : apiClient.delete(url)),
};
