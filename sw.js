const CACHE_NAME = 'nexus-studio-v4';
const ASSETS_TO_CACHE = [
  './', // Met en cache la page d'accueil
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.38.0/min/vs/loader.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.38.0/min/vs/editor/editor.main.css',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.38.0/min/vs/editor/editor.main.nls.js',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.38.0/min/vs/editor/editor.main.js'
];

// Installation et mise en cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Mise en cache des ressources');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Interception des requêtes pour le mode hors-ligne
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Retourne la version en cache si elle existe, sinon va chercher sur le réseau
      return cachedResponse || fetch(event.request);
    })
  );
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
});
