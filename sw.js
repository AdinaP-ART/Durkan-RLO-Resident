/* ============================================================
   sw.js — Durkan Regen Service Worker
   Caches all app files so it works offline after first load
   ============================================================ */

const CACHE_NAME = 'durkan-regen-v2';

const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/data.js',
  '/js/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.x/dist/tabler-icons.min.css',
];

/* Install — cache all assets */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

/* Activate — clear old caches */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* Fetch — serve from cache, fall back to network */
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
