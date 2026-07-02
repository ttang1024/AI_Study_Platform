/* toto.ai service worker — app-shell + runtime caching for offline study.
 * Strategy:
 *   - navigations: network-first, fall back to the cached app shell (so the SPA boots offline)
 *   - same-origin static assets: stale-while-revalidate
 *   - API requests (/api/*): always network; offline data is served by the IndexedDB layer
 */
const VERSION = 'v1';
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
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put('/index.html', copy)).catch(() => undefined);
          return response;
        })
        .catch(() => caches.match('/index.html').then((cached) => cached || caches.match('/'))),
    );
    return;
  }

  event.respondWith(
    caches.open(ASSET_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) cache.put(request, response.clone());
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
