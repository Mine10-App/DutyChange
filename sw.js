// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAf_sjwVHG65vKhezpS_L7KC2j0WHIDaWc",
  authDomain: "leelidc-1f753.firebaseapp.com",
  projectId: "leelidc-1f753",
  storageBucket: "leelidc-1f753.firebasestorage.app",
  messagingSenderId: "43622932335",
  appId: "1:43622932335:web:a7529bce1f19714687129a",
  measurementId: "G-3KD6ZYS599"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Retrieve Firebase Messaging object
const messaging = firebase.messaging();

// Handle background messages (when app is closed)
messaging.setBackgroundMessageHandler(function(payload) {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);
    
    // Customize notification here
    const notificationTitle = payload.notification?.title || 'Duty Manager';
    const notificationOptions = {
        body: payload.notification?.body || 'You have a new notification',
        icon: payload.notification?.icon || '/icon.png',
        badge: '/badge.png',
        data: payload.data || {},
        tag: 'duty-manager-bg-notification',
        requireInteraction: true
    };
    
    // Show notification
    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
    console.log('[firebase-messaging-sw.js] Notification click received.');
    
    const notificationData = event.notification.data || {};
    
    event.notification.close();
    
    // This looks to see if the current is already open and focuses if it is
    event.waitUntil(
        clients.matchAll({
            type: "window",
            includeUncontrolled: true
        })
        .then(function(clientList) {
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url.includes('/') && 'focus' in client) {
                    // Send message to open app
                    client.postMessage({
                        type: 'NOTIFICATION_CLICK',
                        data: notificationData
                    });
                    return client.focus();
                }
            }
            
            // If no window is open, open a new one
            if (clients.openWindow) {
                let url = '/';
                
                // Navigate to specific section based on notification type
                if (notificationData.type === 'announcement') {
                    url = '/#home';
                } else if (notificationData.type === 'duty_change_request') {
                    url = '/#pendingRequests';
                } else if (notificationData.type === 'request_response') {
                    url = '/#myRequests';
                }
                
                return clients.openWindow(url);
            }
        })
    );
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'FIREBASE_CONFIG') {
        console.log('Received Firebase config from main thread');
    }
});
