// sw.js - Service Worker for Push Notifications
const CACHE_NAME = 'duty-manager-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json'
];

// Install Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

// Activate Service Worker
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
        })
    );
});

// Fetch from cache first, then network
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});

// Handle push notifications
self.addEventListener('push', event => {
    const data = event.data?.json() || {
        title: 'Duty Manager',
        body: 'You have a new notification',
        icon: '/icon-192x192.png'
    };

    const options = {
        body: data.body,
        icon: data.icon || '/icon-192x192.png',
        badge: '/badge-72x72.png',
        tag: data.tag || 'duty-notification',
        data: data.data,
        requireInteraction: data.requireInteraction || false,
        actions: data.actions || []
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Handle notification click
self.addEventListener('notificationclick', event => {
    event.notification.close();

    const urlToOpen = '/';
    event.waitUntil(
        clients.matchAll({ type: 'window' })
            .then(windowClients => {
                for (const client of windowClients) {
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

// Handle background messages from Firebase
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'FIREBASE_MESSAGE') {
        const payload = event.data.payload;
        self.registration.showNotification(payload.notification.title, {
            body: payload.notification.body,
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            data: payload.data
        });
    }
});
