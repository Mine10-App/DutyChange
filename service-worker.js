// service-worker.js
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

// Initialize Firebase in service worker
firebase.initializeApp({
    apiKey: "AIzaSyAf_sjwVHG65vKhezpS_L7KC2j0WHIDaWc",
  authDomain: "leelidc-1f753.firebaseapp.com",
  projectId: "leelidc-1f753",
  storageBucket: "leelidc-1f753.firebasestorage.app",
  messagingSenderId: "43622932335",
  appId: "1:43622932335:web:a7529bce1f19714687129a",
  measurementId: "G-3KD6ZYS599"
});

const messaging = firebase.messaging();

// Cache setup
const CACHE_NAME = 'duty-manager-v3';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json'
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
    // Skip Firebase URLs
    if (event.request.url.includes('firebase') || 
        event.request.url.includes('googleapis') ||
        event.request.url.includes('gstatic')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                return response || fetch(event.request);
            })
    );
});

// Background message handler (when app is closed)
messaging.setBackgroundMessageHandler(function(payload) {
    console.log('[service-worker.js] Received background message:', payload);
    
    const notificationTitle = payload.data.title || payload.notification?.title || 'Duty Manager';
    const notificationOptions = {
        body: payload.data.body || payload.notification?.body || 'New notification',
        icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="45" fill="%233498db"/%3E%3Ccircle cx="50" cy="35" r="12" fill="white"/%3E%3Cpath d="M50,55 C65,55 70,70 70,70 L30,70 C30,70 35,55 50,55 Z" fill="white"/%3E%3Cpath d="M35,75 L65,75 L65,85 C65,90 60,95 50,95 C40,95 35,90 35,85 Z" fill="white"/%3E%3Cpath d="M20,20 L20,40 L30,30 Z" fill="%2327ae60"/%3E%3C/svg%3E',
        badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="45" fill="%233498db"/%3E%3Ccircle cx="50" cy="35" r="12" fill="white"/%3E%3Cpath d="M50,55 C65,55 70,70 70,70 L30,70 C30,70 35,55 50,55 Z" fill="white"/%3E%3Cpath d="M35,75 L65,75 L65,85 C65,90 60,95 50,95 C40,95 35,90 35,85 Z" fill="white"/%3E%3Cpath d="M20,20 L20,40 L30,30 Z" fill="%2327ae60"/%3E%3C/svg%3E',
        tag: payload.data.tag || 'duty-manager',
        data: payload.data,
        vibrate: [200, 100, 200],
        actions: [
            {
                action: 'open',
                title: 'Open App'
            },
            {
                action: 'close',
                title: 'Close'
            }
        ]
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Notification click handler
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    const data = event.notification.data || {};
    
    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            clients.matchAll({type: 'window', includeUncontrolled: true})
                .then(windowClients => {
                    // Check if there's already a window/tab open
                    for (let i = 0; i < windowClients.length; i++) {
                        const client = windowClients[i];
                        if (client.url.includes(self.location.origin) && 'focus' in client) {
                            return client.focus();
                        }
                    }
                    
                    // If no window is open, open a new one
                    if (clients.openWindow) {
                        return clients.openWindow('/');
                    }
                })
        );
    }
});
