const CACHE_NAME = 'classbridge-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching offline app shell');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event with custom offline fallback page
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          // Cache newly requested assets dynamically if they are from our origin
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic'
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline and request is for a document, return the offline fallback HTML
          if (event.request.headers.get('accept').includes('text/html')) {
            return new Response(
              `<!DOCTYPE html>
              <html lang="en">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>ClassBridge - Offline</title>
                <style>
                  body {
                    background-color: #0f172a;
                    color: #f8fafc;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                    padding: 20px;
                    text-align: center;
                  }
                  h1 { color: #ef4444; font-size: 24px; margin-bottom: 8px; }
                  p { color: #94a3b8; font-size: 16px; max-width: 400px; margin-bottom: 24px; line-height: 1.5; }
                  .btn {
                    background-color: #38bdf8;
                    color: #0f172a;
                    font-weight: bold;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-size: 15px;
                    cursor: pointer;
                    text-decoration: none;
                  }
                  .btn:hover { background-color: #0ea5e9; }
                </style>
              </head>
              <body>
                <div style="font-size: 48px; margin-bottom: 16px;">📶❌</div>
                <h1>You are offline</h1>
                <p>ClassBridge is unable to connect to the server. Please check your internet connection and try reloading the app.</p>
                <button class="btn" onclick="window.location.reload()">Retry Connection</button>
              </body>
              </html>`,
              {
                headers: { 'Content-Type': 'text/html' }
              }
            );
          }
        });
    })
  );
});
