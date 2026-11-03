const CACHE_NAME = 'ronda-v3';
const PRECACHE_URLS = [
  '/assets/ronda-tokens.css'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Nunca interceptar Firebase, Emuladores (8081/9099), APIs externas ni streams en tiempo real
  if (
    url.origin !== self.location.origin ||
    url.port === '8081' ||
    url.port === '9099' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('firestore') ||
    url.pathname.includes('identitytoolkit')
  ) {
    return;
  }

  // En entorno local / emulador, pasar directo a la red sin retención de caché
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return;
  }

  // Para documentos HTML: Network-First con fallback a caché offline
  if (event.request.mode === 'navigate' || (event.request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Para assets estáticos inmutables (CSS/JS/Fuentes/Imágenes con hash): Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

