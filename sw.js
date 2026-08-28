const CACHE_NAME = 'nexus-studio-v5';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  '[https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.38.0/min/vs/loader.min.js](https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.38.0/min/vs/loader.min.js)',
  '[https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.38.0/min/vs/editor/editor.main.css](https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.38.0/min/vs/editor/editor.main.css)',
  '[https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.38.0/min/vs/editor/editor.main.nls.js](https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.38.0/min/vs/editor/editor.main.nls.js)',
  '[https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.38.0/min/vs/editor/editor.main.js](https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.38.0/min/vs/editor/editor.main.js)'
];

// Installation et mise en cache initiale
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Mise en cache des ressources');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Interception et stratégie hybride (Network First pour les CDNs externes, Cache First pour le local)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.origin !== location.origin) {
    // Stratégie Network First pour les scripts distants / CDN
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Stratégie Cache First pour les fichiers locaux du projet
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        return cachedResponse || fetch(event.request);
      })
    );
  }
});

// Nettoyage des anciens caches lors d'une mise à jour
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Suppression de l\'ancien cache', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.claim();
});
