// sw.js - Service Worker con Auto-Actualización Inmediata y Limpieza de Caché
const CACHE_NAME = 'delarosa-cache-v3';

self.addEventListener('install', (event) => {
  // Forzar activación inmediata sin esperar a que se cierren pestañas
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Eliminar cualquier versión anterior del caché
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Network-First: SIEMPRE pedir la versión más reciente al servidor
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
