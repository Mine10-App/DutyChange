// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

// Your Firebase configuration
firebase.initializeApp({
  apiKey: "AIzaSyAf_sjwVHG65vKhezpS_L7KC2j0WHIDaWc",
  authDomain: "leelidc-1f753.firebaseapp.com",
  projectId: "leelidc-1f753",
  storageBucket: "leelidc-1f753.firebasestorage.app",
  messagingSenderId: "43622932335",
  appId: "1:43622932335:web:a7529bce1f19714687129a",
  measurementId: "G-3KD6ZYS599"
});

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Retrieve Firebase Messaging object
const messaging = firebase.messaging();

// Background message handler (when app is closed)
messaging.setBackgroundMessageHandler(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  
  // Customize notification here
  const notificationTitle = payload.data?.title || 'Duty Manager';
  const notificationOptions = {
    body: payload.data?.body || 'You have a new notification',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    tag: payload.data?.tag || 'duty-manager',
    data: payload.data || {},
    vibrate: [200, 100, 200],
    requireInteraction: true,
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
self.addEventListener('notificationclick', function(event) {
  console.log('Notification clicked:', event.notification.tag);
  event.notification.close();

  event.waitUntil(
    clients.matchAll({type: 'window', includeUncontrolled: true})
      .then(function(clientList) {
        // Check if there's already a window/tab open
        for (var i = 0; i < clientList.length; i++) {
          var client = clientList[i];
          // If so, just focus it
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // If not, open a new window
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});
