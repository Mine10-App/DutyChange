// Service Worker for Duty Manager PWA

const CACHE_NAME = 'duty-manager-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/dcfire.js',
    '/user.js'
];

// Install event
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request)
                    .then(response => {
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        return response;
                    });
            })
    );
});

// Push notification event
self.addEventListener('push', event => {
    let data = {};
    if (event.data) {
        data = event.data.json();
    }
    
    const options = {
        body: data.body || 'New notification from Duty Manager',
        icon: data.icon || '/icons/icon-192x192.png',
        badge: data.badge || '/icons/badge-96x96.png',
        vibrate: [200, 100, 200],
        data: data.data || {},
        actions: data.actions || []
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'Duty Manager', options)
    );
});

// Notification click event
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    const urlToOpen = new URL('/', self.location.origin).href;
    
    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then(windowClients => {
            for (let client of windowClients) {
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Background sync for offline support
self.addEventListener('sync', event => {
    if (event.tag === 'sync-requests') {
        event.waitUntil(syncRequests());
    }
});

async function syncRequests() {
    // Implement background sync logic here
    console.log('Syncing requests in background...');
}
