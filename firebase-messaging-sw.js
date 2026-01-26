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

const messaging = firebase.messaging();

// Background message handler
messaging.setBackgroundMessageHandler(function(payload) {
    console.log('[SW] Background message:', payload);
    
    const notificationOptions = {
        body: payload.data?.body || 'New notification',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="#3498db"/><circle cx="50" cy="35" r="12" fill="white"/><path d="M50,55 C65,55 70,70 70,70 L30,70 C30,70 35,55 50,55 Z" fill="white"/><path d="M35,75 L65,75 L65,85 C65,90 60,95 50,95 C40,95 35,90 35,85 Z" fill="white"/><path d="M20,20 L20,40 L30,30 Z" fill="#27ae60"/></svg>',
        tag: payload.data?.tag || 'default',
        data: payload.data || {}
    };

    return self.registration.showNotification(
        payload.data?.title || 'Duty Manager',
        notificationOptions
    );
});
