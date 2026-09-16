/* Toto Study service worker — app-shell + runtime caching for offline study.
 * Strategy:
 *   - navigations: network-first, fall back to the cached app shell (so the SPA boots offline)
 *   - same-origin static assets: stale-while-revalidate
 *   - API requests (/api/*): always network; offline data is served by the IndexedDB layer
 */
// Bumped to v2 to drop caches from before the guard below: a deploy that removed a still-referenced
// chunk let the CDN's HTML fallback be cached under a .js URL, which no later fetch would correct.
const VERSION = 'v2';
const SHELL_CACHE = `shell-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;
const SHELL_URLS = ['/', '/index.html', '/app.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;          // skip cross-origin (CDN fonts, APIs)
  if (url.pathname.startsWith('/api/')) return;             // API handled by app-level IndexedDB cache

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // /share/{token} is served by the API with that share's own <title> and social meta
          // tags baked in. It boots the same app, but it is one share's page — not the shell
          // every other route should fall back to offline.
          if (!url.pathname.startsWith('/share/')) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put('/index.html', copy)).catch(() => undefined);
          }
          return response;
        })
        .catch(async () => (await caches.match('/index.html'))
          || (await caches.match('/'))
          // respondWith() throws "Failed to convert value to 'Response'" on undefined, which turns
          // a plain offline navigation into a console error with nothing rendered. The install-time
          // cache.addAll() is best-effort, so the shell genuinely can be missing.
          || new Response(
            '<!doctype html><meta charset="utf-8"><title>Offline</title>'
            + '<p style="font:16px system-ui;padding:2rem">You are offline. Reconnect and reload.</p>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
          )),
    );
    return;
  }

  event.respondWith(
    caches.open(ASSET_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          // A missing hashed chunk comes back from the CDN as the SPA shell — 200 text/html, not a
          // 404. Caching that would pin a broken answer for this URL forever, so only store a
          // response whose type still matches what was asked for.
          const html = (response?.headers.get('Content-Type') || '').includes('text/html');
          const wantsScript = request.destination === 'script' || request.destination === 'style';
          if (response && response.status === 200 && !(html && wantsScript)) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});

/* ── Web Push: due-review reminders ──────────────────────────────────────── */

self.addEventListener('push', (event) => {
  let data = { title: 'Easy Study', body: 'You have reviews waiting.', url: '/flashcards' };
  try { data = { ...data, ...event.data.json() }; } catch { /* fall back to defaults */ }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/app.png',
      badge: '/app.png',
      data: { url: data.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
