// Firebase configuration with Cloud Messaging
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

// Initialize services
const db = firebase.firestore();
const analytics = firebase.analytics();
let messaging = null;

// Initialize Cloud Messaging if supported
if (firebase.messaging.isSupported()) {
    messaging = firebase.messaging();
    
    // Configure messaging
    messaging.usePublicVapidKey("YOUR_PUBLIC_VAPID_KEY_HERE"); // You need to generate this
    
    // Handle background messages
    messaging.setBackgroundMessageHandler(function(payload) {
        console.log('Received background message:', payload);
        
        const notificationTitle = payload.notification.title;
        const notificationOptions = {
            body: payload.notification.body,
            icon: '/icons/icon-192x192.png',
            data: payload.data
        };
        
        return self.registration.showNotification(notificationTitle, notificationOptions);
    });
}

// Export Firebase services
window.db = db;
window.messaging = messaging;
window.firebase = firebase;

console.log('Firebase initialized successfully');
