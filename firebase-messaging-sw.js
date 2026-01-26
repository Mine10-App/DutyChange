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

// Retrieve firebase messaging
const messaging = firebase.messaging();

// Background message handler (when app is closed)
messaging.setBackgroundMessageHandler(function(payload) {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);
    
    // Customize notification here
    const notificationTitle = payload.notification?.title || 'Duty Manager';
    const notificationOptions = {
        body: payload.notification?.body || 'You have a new notification',
        icon: '/icon-192x192.png',
        badge: '/icon-72x72.png',
        tag: payload.data?.tag || 'duty-manager',
        data: payload.data || {},
        requireInteraction: true,
        vibrate: [200, 100, 200],
        actions: [
            {
                action: 'view',
                title: 'View',
                icon: '/icon-72x72.png'
            },
            {
                action: 'dismiss',
                title: 'Dismiss',
                icon: '/icon-72x72.png'
            }
        ]
    };

    // Show the notification
    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
    console.log('[firebase-messaging-sw.js] Notification click received.');
    
    const notification = event.notification;
    const action = event.action;
    
    event.notification.close();

    if (action === 'dismiss') {
        console.log('Dismiss was clicked');
        return;
    }

    // Open the app
    event.waitUntil(
        clients.matchAll({
            type: "window",
            includeUncontrolled: true
        }).then(function(clientList) {
            // Check if there's already a window/tab open
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url.includes('/') && 'focus' in client) {
                    client.focus();
                    client.postMessage({
                        type: 'notification_click',
                        data: notification.data
                    });
                    return;
                }
            }
            
            // If no window is open, open a new one
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});

// Handle push subscription change
self.addEventListener('pushsubscriptionchange', function(event) {
    console.log('[firebase-messaging-sw.js] Push subscription changed.');
    
    event.waitUntil(
        self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array('YOUR_VAPID_KEY_HERE')
        })
        .then(function(newSubscription) {
            // Send new subscription to your server
            console.log('New subscription:', newSubscription);
            // You would typically send this to your server to update the subscription
        })
    );
});

// Convert base64 to Uint8Array
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
