import DOMPurify from 'dompurify';

/**
 * Strips script, event handlers and `javascript:` URLs from HTML before it is rendered with
 * `dangerouslySetInnerHTML`. Every such sink must go through this: notes, artifacts and shares can be
 * authored by someone other than the person viewing them, and script in this origin could read the
 * user's AI provider keys from localStorage. The API sanitizes share notes too, and the production CSP
 * (vite-plugin-csp.ts) blocks inline script — this is one layer of three, not the only one.
 */
export const sanitizeHtml = (html: string): string => DOMPurify.sanitize(html);

/**
 * Parses HTML into an inert document for reading its text/structure. Unlike assigning `innerHTML` on an
 * element from `document.createElement` — which belongs to the live document, so `<img onerror>` fires
 * even while it is detached — nothing in a DOMParser document loads or runs.
 */
export const parseInertHtml = (html: string): Document =>
  new DOMParser().parseFromString(html, 'text/html');
