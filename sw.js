// sw.js - Progressive Web App Service Worker
const CACHE_NAME = 'duty-manager-v2';
const OFFLINE_URL = '/offline.html';

// Files to cache for offline use
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/dcfire.js',
  '/user.js',
  '/manifest.json',
  OFFLINE_URL
];

// Install event - cache files
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Installed successfully');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Service Worker: Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('Service Worker: Activated successfully');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip Chrome extensions
  if (event.request.url.startsWith('chrome-extension://')) return;
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version if found
        if (response) {
          console.log('Service Worker: Serving from cache:', event.request.url);
          return response;
        }
        
        // Clone the request
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest)
          .then(response => {
            // Check if response is valid
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response
            const responseToCache = response.clone();
            
            // Cache the new response
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
                console.log('Service Worker: Caching new resource:', event.request.url);
              });
            
            return response;
          })
          .catch(error => {
            console.log('Service Worker: Network request failed:', error);
            
            // If offline and requesting HTML, show offline page
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match(OFFLINE_URL);
            }
            
            // For other requests, return offline icon or empty response
            if (event.request.url.includes('.png') || event.request.url.includes('.jpg') || event.request.url.includes('.svg')) {
              return caches.match('/icon.png');
            }
            
            return new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// Background Sync for offline requests
self.addEventListener('sync', event => {
  console.log('Service Worker: Background sync event:', event.tag);
  
  if (event.tag === 'sync-requests') {
    event.waitUntil(syncPendingRequests());
  }
});

async function syncPendingRequests() {
  try {
    const pendingRequests = await getPendingRequests();
    
    for (const request of pendingRequests) {
      await syncRequest(request);
    }
    
    console.log('Service Worker: Background sync completed');
  } catch (error) {
    console.error('Service Worker: Background sync failed:', error);
  }
}

async function getPendingRequests() {
  // Get pending requests from IndexedDB or localStorage
  const pendingRequests = JSON.parse(localStorage.getItem('pendingRequests') || '[]');
  return pendingRequests;
}

async function syncRequest(request) {
  try {
    // Send request to server
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(request.body)
    });
    
    if (response.ok) {
      // Remove from pending requests
      const pendingRequests = await getPendingRequests();
      const updatedRequests = pendingRequests.filter(req => req.id !== request.id);
      localStorage.setItem('pendingRequests', JSON.stringify(updatedRequests));
      
      console.log('Service Worker: Request synced successfully:', request.id);
    }
  } catch (error) {
    console.error('Service Worker: Failed to sync request:', error);
    throw error;
  }
}

// Push notifications
self.addEventListener('push', event => {
  console.log('Service Worker: Push event received');
  
  let data = {};
  
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {
      title: 'Duty Manager',
      body: 'New notification',
      icon: '/icon.png'
    };
  }
  
  const options = {
    body: data.body || 'You have a new notification',
    icon: data.icon || '/icon.png',
    badge: '/badge.png',
    tag: 'duty-manager-push',
    data: data.data || {},
    actions: data.actions || [
      {
        action: 'view',
        title: 'View'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Duty Manager', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notification click:', event.action);
  
  event.notification.close();
  
  const notificationData = event.notification.data || {};
  
  if (event.action === 'dismiss') {
    return;
  }
  
  // Default action is 'view'
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes('/') && 'focus' in client) {
          // Send message to client about notification
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            data: notificationData
          });
          return client.focus();
        }
      }
      
      // Otherwise open a new window
      if (clients.openWindow) {
        let url = '/';
        
        // Navigate to specific section based on notification type
        if (notificationData.type === 'announcement') {
          url = '/#home';
        } else if (notificationData.type === 'request') {
          url = '/#pendingRequests';
        } else if (notificationData.type === 'leave') {
          url = '/#myRequests';
        }
        
        return clients.openWindow(url);
      }
    })
  );
});

// Message handler from main thread
self.addEventListener('message', event => {
  console.log('Service Worker: Message received:', event.data);
  
  if (event.data && event.data.type === 'SYNC_REQUESTS') {
    // Trigger background sync
    self.registration.sync.register('sync-requests')
      .then(() => {
        console.log('Service Worker: Background sync registered');
        event.ports[0].postMessage({ success: true });
      })
      .catch(error => {
        console.error('Service Worker: Background sync registration failed:', error);
        event.ports[0].postMessage({ success: false, error: error.message });
      });
  }
  
  if (event.data && event.data.type === 'CHECK_NETWORK') {
    // Check network status
    const isOnline = navigator.onLine;
    event.ports[0].postMessage({ online: isOnline });
  }
});

// Periodic background sync (check for updates)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'check-updates') {
    console.log('Service Worker: Periodic sync for updates');
    event.waitUntil(checkForUpdates());
  }
});

async function checkForUpdates() {
  try {
    // Check for new announcements/requests
    const response = await fetch('/api/check-updates', {
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    
    if (response.ok) {
      const updates = await response.json();
      
      if (updates.hasNewData) {
        // Send message to clients
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'NEW_DATA_AVAILABLE',
            data: updates
          });
        });
      }
    }
  } catch (error) {
    console.error('Service Worker: Failed to check updates:', error);
  }
}
