/* NC38 PWA Service Worker — Network-First OTA Auto-Update (20261121101531) */
const CACHE_NAME = 'mrl-pwa-20261121101531';
const CORE_SHELL = [
  './',
  './index.html',
  './manifest.json?v=nc3',
  './mrl_initial_seed.json',
  './static/fonts.css',
  './static/styles.css',
  './static/mobile.css',
  './static/a11y.js',
  './static/ui.js',
  './static/js/core_store.js',
  './static/js/01-core.js',
  './static/js/02-boot.js',
  './static/js/03-views.js',
  './static/js/04-media.js',
  './static/js/05-split.js',
  './static/js/06-reference.js',
  './static/js/07-flashcards.js',
  './static/js/08-data.js',
  './static/js/09-english.js',
  './static/js/10-english-hub.js',
  './static/js/mobile_shell.js',
  './static/icons/icon-nc-192.png',
  './static/icons/icon-nc-512.png',
  './static/icons/logo.png',
  './static/icons/apple-touch-icon.png',
  './static/nc38_icon.ico'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(CORE_SHELL.map((u) => cache.add(u).catch(() => null)))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('mrl-pwa-') && k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function _isNetworkFirstAsset(url) {
  const p = url.pathname.toLowerCase();
  return (
    p.endsWith('/') ||
    p.endsWith('.html') ||
    p.endsWith('.css') ||
    p.endsWith('.js') ||
    p.endsWith('.json')
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (_isNetworkFirstAsset(url) || req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => null);
          }
          return res;
        })
        .catch(() =>
          caches.match(req, { ignoreSearch: true }).then((cached) => {
            if (cached) return cached;
            if (req.mode === 'navigate') return caches.match('./index.html').then((r) => r || caches.match('./') || Response.error());
            return Response.error();
          })
        )
    );
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const netFetch = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => null);
        }
        return res;
      }).catch(() => cached);
      return cached || netFetch;
    })
  );
});
