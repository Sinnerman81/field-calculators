/* FieldKit service worker — cache-first app shell, fully offline. */
importScripts('./version.js');

const APP_VERSION = self.FIELDKIT_VERSION;
const CACHE_NAME = `field-calc-${APP_VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './version.js',
  './styles.css',
  './app.js',
  './manifest.json',
  './modules/format.js',
  './modules/summary.js',
  './modules/registry.js',
  './modules/hydraulic-load.js',
  './modules/tank-volumes.js',
  './modules/pressure-distribution.js',
  './modules/drip-oscar.js',
  './modules/field-utilities.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

const SHELL = new URL('./index.html', self.location).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(ASSETS);
      // Wait for the page to prompt before activating a new build, so field
      // users are never swapped mid-calculation without a reload.
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key !== CACHE_NAME &&
              (key.startsWith('field-calc-') || key.startsWith('fieldkit-')),
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Hash routes all resolve to the precached app shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedShell = await cache.match(SHELL, { ignoreSearch: true });
        if (cachedShell) return cachedShell;

        try {
          return await fetch(request);
        } catch (error) {
          return new Response(
            '<!doctype html><meta charset="utf-8"><title>Offline</title><p>FieldKit is not cached yet. Reconnect once to install the offline copy.</p>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
          );
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;

      try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') {
          cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        return new Response('Offline', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    })(),
  );
});

// Allow the page to activate a waiting update without a second reload.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

