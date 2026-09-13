const CACHE_NAME = 'fertcalc-static-v2';
const STATIC_ASSETS = [
  '/manifest.json',
  '/icons/fertcalc.svg',
  '/icons/fertcalc-192.png',
  '/icons/fertcalc-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)), self.skipWaiting()])
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith('fertcalc-') && cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName))
        )
      ),
      self.clients.claim(),
    ])
  );
});
