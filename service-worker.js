// service-worker.js - Enhanced with offline sync, push notifications, and background updates
const CACHE_VERSION = 'v2.0';
const STATIC_CACHE = `duty-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `duty-dynamic-${CACHE_VERSION}`;
const OFFLINE_CACHE = `duty-offline-${CACHE_VERSION}`;

// Core files that make the app work offline
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/splash-640x1136.png',
  'https://cdnjs.cloudflare.com/ajax/libs/js-sha256/0.9.0/sha256.min.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js'
];

// Files to cache on user demand (lazy loading)
const LAZY_ASSETS = [
  // Add paths to your JS and CSS files
  '/styles.css',
  '/app.js'
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[Service Worker] Caching core assets');
        return cache.addAll(CORE_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Skip waiting');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old caches
          if (cacheName !== STATIC_CACHE && 
              cacheName !== DYNAMIC_CACHE && 
              cacheName !== OFFLINE_CACHE) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('[Service Worker] Claiming clients');
      return self.clients.claim();
    })
    .then(() => {
      // Register periodic sync for background updates
      if ('periodicSync' in self.registration) {
        self.registration.periodicSync.register('update-content', {
          minInterval: 12 * 60 * 60 * 1000, // 12 hours
        }).then(() => {
          console.log('[Service Worker] Periodic sync registered');
        }).catch((error) => {
          console.log('[Service Worker] Periodic sync failed:', error);
        });
      }
      
      // Register background sync for form submissions
      if ('sync' in self.registration) {
        self.registration.sync.register('sync-forms').then(() => {
          console.log('[Service Worker] Background sync registered');
        });
      }
    })
  );
});

// Fetch event - smart caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and browser extensions
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  
  // Handle different types of requests with different strategies
  if (isCoreAsset(request)) {
    // Cache First for core assets
    event.respondWith(cacheFirst(request));
  } else if (isFirestoreRequest(request)) {
    // Network First with cache fallback for Firestore data
    event.respondWith(networkFirst(request));
  } else if (isImageRequest(request)) {
    // Cache First for images with network fallback
    event.respondWith(cacheFirst(request));
  } else {
    // Network First for everything else
    event.respondWith(networkFirst(request));
  }
});

// Cache First strategy
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    // Cache the new response
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // If both cache and network fail, return offline page
    const offlineResponse = await cache.match('/offline.html');
    return offlineResponse || new Response('Network error', {
      status: 408,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Network First strategy
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Both network and cache failed
    throw error;
  }
}

// Stale While Revalidate strategy (for frequently updated content)
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  // Return cached response immediately
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => {
    // Silently fail if network fails
    console.log('[Service Worker] Network update failed');
  });
  
  return cachedResponse || fetchPromise;
}

// Push notification handler
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received:', event);
  
  let data = {
    title: 'Duty Manager',
    body: 'You have a new notification',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    data: { url: '/' }
  };
  
  if (event.data) {
    try {
      const pushData = event.data.json();
      data = { ...data, ...pushData };
    } catch (error) {
      data.body = event.data.text() || data.body;
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon,
    badge: '/icon-72x72.png',
    tag: 'duty-notification',
    data: data.data || { url: '/' },
    vibrate: [200, 100, 200],
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event.notification.data);
  
  event.notification.close();
  
  const { action, data } = event.notification;
  
  if (action === 'dismiss') {
    return;
  }
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url.includes('/') && 'focus' in client) {
          // Navigate existing window if needed
          if (data && data.url) {
            client.navigate(data.url);
          }
          return client.focus();
        }
      }
      
      // Open new window if app isn't open
      const urlToOpen = data?.url || '/';
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Background sync handler
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'sync-forms') {
    event.waitUntil(syncPendingForms());
  } else if (event.tag === 'sync-roster') {
    event.waitUntil(syncRosterData());
  }
});

// Sync pending forms from IndexedDB
async function syncPendingForms() {
  console.log('[Service Worker] Syncing pending forms...');
  
  try {
    // Get pending forms from IndexedDB
    const pendingForms = await getPendingFormsFromIndexedDB();
    
    for (const form of pendingForms) {
      try {
        const response = await fetch(form.url, {
          method: form.method || 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(form.data)
        });
        
        if (response.ok) {
          await removeFormFromIndexedDB(form.id);
          console.log(`[Service Worker] Synced form: ${form.id}`);
          
          // Show notification for successful sync
          self.registration.showNotification('Form Submitted', {
            body: 'Your offline form has been submitted',
            icon: '/icon-192x192.png',
            tag: 'sync-success'
          });
        }
      } catch (error) {
        console.error(`[Service Worker] Failed to sync form ${form.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[Service Worker] Sync error:', error);
  }
}

// Sync roster data in background
async function syncRosterData() {
  try {
    const response = await fetch('/api/roster/latest');
    
    if (response.ok) {
      const rosterData = await response.json();
      const cache = await caches.open(DYNAMIC_CACHE);
      
      // Store in cache
      await cache.put('/api/roster/latest', new Response(JSON.stringify(rosterData)));
      
      // Store in IndexedDB for offline access
      await storeRosterInIndexedDB(rosterData);
      
      console.log('[Service Worker] Roster data synced');
    }
  } catch (error) {
    console.error('[Service Worker] Roster sync failed:', error);
  }
}

// Periodic background sync
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-content') {
    console.log('[Service Worker] Periodic sync triggered');
    event.waitUntil(updateCachedContent());
  }
});

// Update cached content
async function updateCachedContent() {
  console.log('[Service Worker] Updating cached content...');
  
  try {
    // Update manifest
    const manifestResponse = await fetch('/manifest.json');
    if (manifestResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put('/manifest.json', manifestResponse);
    }
    
    // Update offline page
    const offlineResponse = await fetch('/offline.html');
    if (offlineResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put('/offline.html', offlineResponse);
    }
    
    console.log('[Service Worker] Content updated successfully');
  } catch (error) {
    console.error('[Service Worker] Content update failed:', error);
  }
}

// Message handler from main thread
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  
  console.log('[Service Worker] Message received:', type);
  
  switch (type) {
    case 'CACHE_ASSETS':
      cacheAssets(payload.urls);
      break;
    
    case 'CLEAR_CACHE':
      clearSpecificCache(payload.cacheName);
      break;
    
    case 'GET_CACHE_INFO':
      getCacheInfo().then(info => {
        event.source.postMessage({
          type: 'CACHE_INFO_RESPONSE',
          payload: info
        });
      });
      break;
    
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
  }
});

// Helper functions
function isCoreAsset(request) {
  return CORE_ASSETS.some(asset => 
    request.url.endsWith(asset) || 
    request.url.includes(asset)
  );
}

function isFirestoreRequest(request) {
  return request.url.includes('firestore.googleapis.com');
}

function isImageRequest(request) {
  return request.destination === 'image';
}

async function cacheAssets(urls) {
  const cache = await caches.open(STATIC_CACHE);
  return Promise.all(
    urls.map(url => cache.add(url).catch(error => {
      console.error(`[Service Worker] Failed to cache ${url}:`, error);
    }))
  );
}

async function clearSpecificCache(cacheName) {
  return caches.delete(cacheName);
}

async function getCacheInfo() {
  const cacheNames = await caches.keys();
  const info = {};
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    info[cacheName] = requests.map(req => req.url);
  }
  
  return info;
}

// IndexedDB helper functions (simplified)
async function getPendingFormsFromIndexedDB() {
  return new Promise((resolve) => {
    const request = indexedDB.open('DutyManagerDB', 1);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction('pendingForms', 'readonly');
      const store = transaction.objectStore('pendingForms');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        resolve(getAllRequest.result);
      };
      
      getAllRequest.onerror = () => {
        resolve([]);
      };
    };
    
    request.onerror = () => {
      resolve([]);
    };
  });
}

async function storeRosterInIndexedDB(rosterData) {
  // Implementation for storing roster data in IndexedDB
  return Promise.resolve();
}
