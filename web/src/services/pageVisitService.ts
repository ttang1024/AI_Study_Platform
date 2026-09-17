import { getApiUrl } from '../utils/env';

/**
 * Page-view beacons.
 *
 * Deliberately not on `apiClient`: this fires on every route change, must survive the page being
 * closed mid-flight (`keepalive`), and must never drag a visitor into the shared refresh-on-401
 * flow — an expired token here just means the visit is recorded as anonymous, which is correct.
 *
 * The two ids are random and live only in this browser. They exist to count *unique visitors* and
 * *sessions* without identifying anyone; nothing else is derived from them, and the server stores
 * no URL query strings, no user agent and no IP address alongside them.
 */

const VISITOR_KEY = 'sp_visitor_id';
const SESSION_KEY = 'sp_session_id';

const randomId = (): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    // Fall through to the arithmetic id below.
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

// Private-mode browsers throw on storage access, so every id falls back to a per-tab value held
// in memory: tracking degrades to "this visit happened" rather than breaking the page.
let memoryVisitorId: string | null = null;
let memorySessionId: string | null = null;

const readOrCreate = (
  storage: 'local' | 'session',
  key: string,
  fallback: () => string | null,
  remember: (value: string) => void,
): string => {
  const created = randomId();
  try {
    const store = storage === 'local' ? window.localStorage : window.sessionStorage;
    const existing = store.getItem(key);
    if (existing) return existing;
    store.setItem(key, created);
    return created;
  } catch {
    const existing = fallback();
    if (existing) return existing;
    remember(created);
    return created;
  }
};

/** Stable for as long as the browser keeps site data — one "unique visitor". */
export const getVisitorId = (): string =>
  readOrCreate('local', VISITOR_KEY, () => memoryVisitorId, (v) => { memoryVisitorId = v; });

/** Lives for one tab — one "session". */
export const getSessionId = (): string =>
  readOrCreate('session', SESSION_KEY, () => memorySessionId, (v) => { memorySessionId = v; });

// The referrer belongs to the page load, not to each SPA route, so it rides only the first beacon;
// sending it on every route change would credit the whole session to one external link.
let referrerSent = false;

// React re-renders, StrictMode's double effect, and a replace() to the same path would otherwise
// each post a visit. Only a genuine change of path counts.
let lastPath: string | null = null;

/** Clears the per-load guards. Tests only. */
export const resetPageVisitTracking = (): void => {
  referrerSent = false;
  lastPath = null;
};

/**
 * Records one page view. Fire-and-forget by design: analytics must never surface an error to the
 * visitor or block a navigation, so every failure path here is a silent no-op.
 */
export const trackPageVisit = (path: string): void => {
  if (typeof window === 'undefined' || !path) return;
  if (path === lastPath) return;
  lastPath = path;

  const referrer = referrerSent ? null : (document.referrer || null);
  referrerSent = true;

  const body = JSON.stringify({
    path,
    referrer,
    visitorId: getVisitorId(),
    sessionId: getSessionId(),
  });

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = window.localStorage.getItem('sp_access_token');
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    // No token available; the visit is recorded as anonymous.
  }

  try {
    // keepalive lets the request outlive the page it describes — the last visit before a close or
    // an external navigation is exactly the one a naive fetch drops.
    void fetch(`${getApiUrl()}/api/analytics/page-visits`, {
      method: 'POST',
      headers,
      body,
      keepalive: true,
      credentials: 'omit',
    }).catch(() => undefined);
  } catch {
    // Offline, blocked by an extension, or no fetch at all: the visit is simply not counted.
  }
};
