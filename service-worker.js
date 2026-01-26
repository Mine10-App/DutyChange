// Basic service worker for caching
const CACHE_NAME = 'duty-manager-sw-v1';

self.addEventListener('install', event => {
    console.log('Service Worker installing');
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('Service Worker activating');
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
    // Let browser handle non-GET requests
    if (event.request.method !== 'GET') return;
    
    event.respondWith(
        fetch(event.request).catch(() => {
            return new Response('You are offline. Please check your connection.');
        })
    );
});
