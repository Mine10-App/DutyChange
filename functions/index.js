// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.sendPushNotification = functions.firestore
    .document('notifications/{notificationId}')
    .onCreate(async (snap, context) => {
        const notification = snap.data();
        
        // Get user's FCM token
        const userDoc = await admin.firestore()
            .collection('userDevices')
            .doc(notification.to)
            .get();
        
        if (!userDoc.exists || !userDoc.data().fcmToken) {
            console.log('No FCM token for user:', notification.to);
            return null;
        }
        
        const fcmToken = userDoc.data().fcmToken;
        
        const message = {
            token: fcmToken,
            notification: {
                title: notification.title,
                body: notification.body
            },
            data: notification.data || {},
            webpush: {
                headers: {
                    Urgency: "high"
                },
                notification: {
                    icon: '/icon-192x192.png',
                    badge: '/badge-72x72.png',
                    requireInteraction: true
                }
            }
        };
        
        try {
            await admin.messaging().send(message);
            console.log('Notification sent successfully to:', notification.to);
            
            // Mark notification as sent
            await snap.ref.update({ sent: true });
        } catch (error) {
            console.error('Error sending notification:', error);
        }
        
        return null;
    });

// Deploy with: firebase deploy --only functions
