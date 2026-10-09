import axios from 'axios';
import { useSyncExternalStore } from 'react';
import { getApiUrl } from '../utils/env';

/**
 * The access token lives in memory only — never in localStorage.
 *
 * A token in localStorage is readable by any script that ever runs on the origin, so a single XSS hands
 * an attacker a working bearer token they can use from anywhere. In memory, it dies with the tab, and a
 * reload re-mints it from the HttpOnly refresh cookie (which no script can read) via
 * {@link ensureAccessToken}. The non-secret profile (`sp_user`) stays in localStorage so the app knows
 * a session exists and can render immediately.
 */

let accessToken: string | null = null;
let inflightRefresh: Promise<string> | null = null;
const listeners = new Set<() => void>();

/** The server rejected the refresh cookie (expired, revoked, deactivated account) — the session is over. */
export class SessionRejectedError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'SessionRejectedError';
  }
}

export const getAccessToken = (): string | null => accessToken;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
  listeners.forEach((listener) => listener());
};

export const clearAccessToken = (): void => setAccessToken(null);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The current access token, re-rendering when it is refreshed. */
export const useAccessToken = (): string | null => useSyncExternalStore(subscribe, getAccessToken, getAccessToken);

/**
 * Mints a new access token from the refresh cookie. Single-flight: concurrent callers share one request,
 * which matters because each refresh rotates the cookie — two in parallel would race each other.
 * Throws {@link SessionRejectedError} when the server says no, and the original error when it could not
 * be reached (offline), so callers can tell "signed out" from "no network".
 */
export function refreshAccessToken(): Promise<string> {
  if (!inflightRefresh) {
    inflightRefresh = axios
      .post(`${getApiUrl()}/api/auth/refresh-token`, {}, { withCredentials: true })
      .then((response) => {
        const token = response.data?.data?.accessToken as string | undefined;
        if (!token) throw new SessionRejectedError();
        setAccessToken(token);
        return token;
      })
      .catch((error) => {
        if (error instanceof SessionRejectedError) throw error;
        const status = error?.response?.status as number | undefined;
        if (status !== undefined && status >= 400 && status < 500) {
          clearAccessToken();
          throw new SessionRejectedError();
        }
        throw error;
      })
      .finally(() => {
        inflightRefresh = null;
      });
  }
  return inflightRefresh;
}

/** The current token, refreshing first if there is none. Null when no session can be established. */
export async function ensureAccessToken(): Promise<string | null> {
  if (accessToken) return accessToken;
  try {
    return await refreshAccessToken();
  } catch {
    return null;
  }
}
