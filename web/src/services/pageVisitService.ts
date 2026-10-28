import { getApiUrl } from '../utils/env';
import { getAccessToken } from './accessToken';

/**
 * Page-view beacons.
 *
 * Deliberately not on `apiClient`: this fires on every route change, must survive the page being
 * closed mid-flight (`keepalive`), and must never drag a visitor into the shared refresh-on-401
 * flow — an expired token here just means the visit is recorded as anonymous, which is correct.
 *
 * The visitor id is random and lives only in this browser. It exists to count *unique visitors*
 * without identifying anyone; nothing else is derived from it, and the server stores no URL query
 * strings, no user agent and no IP address alongside it.
 */

const VISITOR_KEY = 'sp_visitor_id';

const randomId = (): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    // Fall through to the arithmetic id below.
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

// Private-mode browsers throw on storage access, so the id falls back to a per-tab value held in
// memory: tracking degrades to "this visit happened" rather than breaking the page.
let memoryVisitorId: string | null = null;

/** Stable for as long as the browser keeps site data — one "unique visitor". */
export const getVisitorId = (): string => {
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const created = randomId();
    window.localStorage.setItem(VISITOR_KEY, created);
    return created;
  } catch {
    memoryVisitorId ??= randomId();
    return memoryVisitorId;
  }
};

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
  });

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = getAccessToken();
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
