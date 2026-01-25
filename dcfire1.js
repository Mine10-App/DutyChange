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
    
    // Use your own generated VAPID key
    // Get this from Firebase Console -> Project Settings -> Cloud Messaging
    messaging.usePublicVapidKey('BLxqOa9X4sGjKpLmNzQwErTyUiOpAsDfGhJkLzXcVbNqWeRtYuIoPaSdFgHjKlMn');
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
