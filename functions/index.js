// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.sendDutyNotification = functions.firestore
    .document('notifications/{notificationId}')
    .onCreate(async (snap, context) => {
        const notification = snap.data();
        
        // Get user's FCM token
        const userDoc = await admin.firestore()
            .collection('userDevices')
            .doc(notification.to)
            .get();
        
        if (!userDoc.exists) return null;
        
        const fcmToken = userDoc.data().fcmToken;
        if (!fcmToken) return null;
        
        // Send notification
        const message = {
            token: fcmToken,
            notification: {
                title: notification.title,
                body: notification.body
            },
            data: notification.data || {}
        };
        
        try {
            await admin.messaging().send(message);
            console.log('Notification sent successfully');
        } catch (error) {
            console.error('Error sending notification:', error);
        }
        
        return null;
    });
