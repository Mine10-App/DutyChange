// dcfire.js - Firebase Configuration
// Replace with your Firebase project config
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

// Make db and messaging available globally
const db = firebase.firestore();
let messaging = null;

// Check for Firebase Messaging support
if (firebase.messaging.isSupported()) {
    messaging = firebase.messaging();
    
    // For FCM V1 - Get VAPID key from Firebase Console
    // Go to: Project Settings -> Cloud Messaging -> Web Configuration
    messaging.getToken({
        vapidKey: "BNld9EIubEB5i3S9IpuJmSgmJcw-u0z1ZEEtqSi3YGAoo8Y3FH0vm94GrqNKCcW2Kptv9wV76V4zzLSNDdSeoYo" // Your VAPID key here
    }).then((currentToken) => {
        if (currentToken) {
            console.log('FCM Token:', currentToken);
            // Token will be saved when user logs in
        } else {
            console.log('No registration token available.');
        }
    }).catch((err) => {
        console.log('An error occurred while retrieving token:', err);
    });
}

// Enable offline persistence
db.enablePersistence()
  .catch((err) => {
      if (err.code == 'failed-precondition') {
          console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
      } else if (err.code == 'unimplemented') {
          console.log('The current browser does not support persistence.');
      }
  });

// Export for use in main script
window.db = db;
window.messaging = messaging;
