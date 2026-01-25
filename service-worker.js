// service-worker.js
const CACHE_NAME = 'duty-manager-v1.0';
const OFFLINE_URL = '/offline.html';

// Static resources to cache
const STATIC_RESOURCES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/splash-640x1136.png',
  // Add your CSS, JS, and other assets
];

// Dynamic resources (APIs) to cache
const DYNAMIC_CACHE = 'duty-manager-dynamic-v1';

// Install event - cache static resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching static resources');
        return cache.addAll(STATIC_RESOURCES);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network first with cache fallback
self.addEventListener('fetch', event => {
  // Skip cross-origin requests and non-GET requests
  if (!event.request.url.startsWith(self.location.origin) || 
      event.request.method !== 'GET') {
    return;
  }

  // For API calls, use network first, cache as fallback
  if (event.request.url.includes('/api/') || 
      event.request.url.includes('firestore.googleapis.com')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache successful API responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Return cached API response if available
          return caches.match(event.request)
            .then(cachedResponse => cachedResponse || 
                  caches.match(OFFLINE_URL));
        })
    );
  } else {
    // For static assets, use cache first with network fallback
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request)
            .then(response => {
              // Don't cache if not a valid response
              if (!response || response.status !== 200 || 
                  response.type !== 'basic') {
                return response;
              }
              const responseClone = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, responseClone));
              return response;
            });
        })
    );
  }
});

// Push notification event handler
self.addEventListener('push', event => {
  console.log('Push notification received:', event);

  let notificationData = {
    title: 'Duty Manager',
    body: 'You have a new notification',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    tag: 'duty-manager-notification',
    data: { url: '/' }
  };

  // Parse push data if available
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        ...data.notification,
        data: data.data || notificationData.data
      };
    } catch (e) {
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      data: notificationData.data,
      vibrate: [200, 100, 200, 100, 200],
      actions: [
        { action: 'view', title: 'View' },
        { action: 'close', title: 'Close' }
      ]
    })
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  console.log('Notification clicked:', event.notification.data);
  event.notification.close();

  // Handle action buttons
  if (event.action === 'close') {
    return;
  }

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Check if app is already open
        for (const client of windowClients) {
          if (client.url.includes('/') && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window if app isn't open
        if (clients.openWindow) {
          const urlToOpen = event.notification.data?.url || '/';
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', event => {
  console.log('Background sync:', event.tag);
  
  if (event.tag === 'sync-requests') {
    event.waitUntil(syncPendingRequests());
  }
});

// Function to sync pending requests when back online
async function syncPendingRequests() {
  // You would implement this to sync any offline actions
  const pendingRequests = await getPendingRequestsFromIndexedDB();
  
  for (const request of pendingRequests) {
    try {
      await sendRequestToServer(request);
      await removeRequestFromIndexedDB(request.id);
    } catch (error) {
      console.error('Failed to sync request:', error);
    }
  }
}

// Periodic sync for background updates
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-roster') {
    event.waitUntil(updateRosterInBackground());
  }
});

async function updateRosterInBackground() {
  // Fetch and cache latest roster data
  const response = await fetch('/api/roster/latest');
  if (response.ok) {
    const rosterData = await response.json();
    const cache = await caches.open(DYNAMIC_CACHE);
    await cache.put('/api/roster/latest', new Response(JSON.stringify(rosterData)));
  }
}
