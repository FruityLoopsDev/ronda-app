const CACHE_NAME = 'ronda-v2';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/admin.html',
  '/network.html',
  '/assets/ronda-tokens.css',
  '/css/styles.css',
  '/src/entry-admin.ts',
  '/src/host-admin.ts',
  '/src/firebase-config.ts'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Solo cachear GET requests para recursos de la app
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Cachear respuestas exitosas para futuras visitas offline
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });
    }).catch(() => {
      // En caso de fallo total, intentar servir de cache aunque esté viejo
      return caches.match(event.request).then((cached) => cached || new Response('Offline mode', { status: 503 }));
    })
  );
});