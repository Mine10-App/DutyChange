// service-worker.js
const CACHE_NAME = 'duty-manager-v1.3.2';
const urlsToCache = [
  '/',
  '/index.html',
  '/dcfire.js',
  '/user.js',
  '/icon-192x192.png',
  '/icon-512x512.png',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js'
  // add other critical assets
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
      .catch(() => caches.match('/'))
  );
});

// ── Push Notifications ──────────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  const title = data.notification?.title || 'Duty Manager';
  const options = {
    body: data.notification?.body || 'You have a new update',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [200, 100, 200],
    data: data.data || {}
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const urlToOpen = '/'; // or dynamic based on event.notification.data

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientsArr => {
        const hadWindowToFocus = clientsArr.some(windowClient => {
          if (windowClient.url === urlToOpen) {
            windowClient.focus();
            return true;
          }
          return false;
        });

        if (!hadWindowToFocus)
          clients.openWindow(urlToOpen).catch(console.error);
      })
  );
});
