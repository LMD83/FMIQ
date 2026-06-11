// FMIQ service worker — minimal app-shell cache for the field PWA (S11 shell).
// Strategy: cache-first for the shell, network-first for /api with a cached fallback.
// Offline write queueing (job start/close, photos) is layered on in the field app (EP-6).
const SHELL = 'fmiq-shell-v1';
const SHELL_ASSETS = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // never cache mutations
  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/')) {
    // Network-first for data; fall back to last-known cache when offline.
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // Cache-first for the shell / static assets.
  event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
});
