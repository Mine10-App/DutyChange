// sw.js - Service Worker for Duty Manager PWA
const CACHE_NAME = 'duty-manager-v1.0';
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/js-sha256/0.9.0/sha256.min.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-analytics.js'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(FILES_TO_CACHE);
      })
      .then(() => {
        console.log('[Service Worker] Install completed');
        return self.skipWaiting();
      })
  );
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[Service Worker] Removing old cache:', key);
          return caches.delete(key);
        }
      }));
    })
  );
  console.log('[Service Worker] Activated');
  return self.clients.claim();
});

// Fetch Strategy: Cache First, Network Fallback with Firestore exception
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // Handle Firestore requests specially - always try network first
  if (url.hostname === 'firestore.googleapis.com') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          return response;
        })
        .catch((error) => {
          console.log('[Service Worker] Firestore request failed, returning offline response');
          
          // Return a placeholder response for Firestore when offline
          return new Response(JSON.stringify({
            error: 'offline',
            message: 'You are offline. Firestore data will sync when online.'
          }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }
  
  // Skip Firebase SDK requests (let them go to network)
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached response if found
        if (cachedResponse) {
          console.log('[Service Worker] Serving from cache:', event.request.url);
          return cachedResponse;
        }
        
        // Otherwise fetch from network
        console.log('[Service Worker] Fetching from network:', event.request.url);
        return fetch(event.request)
          .then((response) => {
            // Don't cache if not a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response
            const responseToCache = response.clone();
            
            // Cache the new response
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
                console.log('[Service Worker] Cached new resource:', event.request.url);
              });
            
            return response;
          })
          .catch((error) => {
            console.log('[Service Worker] Fetch failed:', error);
            
            // Return offline page if available
            if (event.request.mode === 'navigate') {
              return caches.match('/');
            }
            
            return new Response('You are offline. Please check your internet connection.', {
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

// Background Sync for Offline Data
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'sync-offline-data') {
    event.waitUntil(syncOfflineData());
  }
  
  if (event.tag === 'send-pending-notifications') {
    event.waitUntil(sendPendingNotifications());
  }
});

async function syncOfflineData() {
  console.log('[Service Worker] Syncing offline data...');
  
  try {
    // Get offline requests from IndexedDB
    const db = await openIndexedDB();
    const offlineRequests = await getAllFromStore(db, 'offlineRequests');
    
    console.log('[Service Worker] Found', offlineRequests.length, 'offline requests');
    
    // Process each offline request
    for (const request of offlineRequests) {
      try {
        // Send the request
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body
        });
        
        if (response.ok) {
          console.log('[Service Worker] Successfully synced:', request.url);
          
          // Remove from offline storage on success
          await deleteFromStore(db, 'offlineRequests', request.id);
        } else {
          console.log('[Service Worker] Failed to sync:', request.url, response.status);
        }
      } catch (error) {
        console.error('[Service Worker] Error syncing request:', error);
      }
    }
    
    // Notify clients that sync is complete
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        data: { synced: offlineRequests.length }
      });
    });
    
  } catch (error) {
    console.error('[Service Worker] Error in syncOfflineData:', error);
  }
}

async function sendPendingNotifications() {
  console.log('[Service Worker] Sending pending notifications...');
  
  // Notify the client to send pending notifications
  const clients = await self.clients.matchAll();
  if (clients.length > 0) {
    clients.forEach(client => {
      client.postMessage({
        type: 'PROCESS_PENDING_NOTIFICATIONS'
      });
    });
  }
}

// Push Notifications
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received:', event);
  
  if (!event.data) {
    console.log('[Service Worker] Push event but no data');
    return;
  }
  
  let data;
  try {
    data = event.data.json();
  } catch (error) {
    console.log('[Service Worker] Push data is not JSON, using text:', event.data.text());
    data = {
      title: 'Duty Manager',
      body: event.data.text(),
      icon: '/icons/icon-192x192.png'
    };
  }
  
  const options = {
    body: data.body || 'New notification from Duty Manager',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: data.tag || 'duty-manager-notification',
    data: data.data || {},
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false
  };
  
  // Add vibrate if supported
  if ('vibrate' in navigator) {
    options.vibrate = [200, 100, 200];
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Duty Manager', options)
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click:', event.notification.tag);
  
  event.notification.close();
  
  const notificationData = event.notification.data || {};
  const urlToOpen = notificationData.url || '/';
  
  event.waitUntil(
    clients.matchAll({ 
      type: 'window', 
      includeUncontrolled: true 
    })
      .then((clientList) => {
        // Check if there's already a window/tab open with the target URL
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        
        // If not, open a new window/tab
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Notification Close Handler
self.addEventListener('notificationclose', (event) => {
  console.log('[Service Worker] Notification closed:', event.notification.tag);
});

// Message Handler for Communication with App
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_DATA') {
    cacheData(event.data);
  }
  
  if (event.data && event.data.type === 'PROCESS_PENDING_NOTIFICATIONS') {
    // Forward to all clients
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'PROCESS_PENDING_NOTIFICATIONS'
        });
      });
    });
  }
});

// Helper Functions for IndexedDB
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('DutyManagerDB', 2);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object store for offline requests
      if (!db.objectStoreNames.contains('offlineRequests')) {
        const store = db.createObjectStore('offlineRequests', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('userId', 'userId', { unique: false });
      }
      
      // Create object store for cached data
      if (!db.objectStoreNames.contains('cachedData')) {
        const store = db.createObjectStore('cachedData', { keyPath: 'key' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

function getAllFromStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteFromStore(db, storeName, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function cacheData(data) {
  return openIndexedDB()
    .then(db => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['cachedData'], 'readwrite');
        const store = transaction.objectStore('cachedData');
        
        const item = {
          key: data.key,
          data: data.data,
          timestamp: Date.now()
        };
        
        const request = store.put(item);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
}

// Periodic Sync (if supported)
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'update-cache') {
      console.log('[Service Worker] Periodic sync triggered');
      event.waitUntil(updateCache());
    }
  });
}

async function updateCache() {
  const cache = await caches.open(CACHE_NAME);
  const requests = FILES_TO_CACHE.map(url => new Request(url));
  
  for (const request of requests) {
    try {
      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response);
        console.log('[Service Worker] Updated cache for:', request.url);
      }
    } catch (error) {
      console.error('[Service Worker] Failed to update cache for:', request.url, error);
    }
  }
}

// Handle Firebase Messaging
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[Service Worker] Push subscription changed');
  
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options)
      .then((subscription) => {
        // Send new subscription to server
        return fetch('/api/update-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldSubscription: event.oldSubscription,
            newSubscription: subscription
          })
        });
      })
  );
});

console.log('[Service Worker] Loaded successfully');
