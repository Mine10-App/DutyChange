// cloud-functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.sendPushNotification = functions.firestore
    .document('pendingNotifications/{notificationId}')
    .onCreate(async (snap, context) => {
        const notification = snap.data();
        
        try {
            const message = {
                token: notification.to,
                notification: notification.notification,
                data: notification.data || {},
                webpush: {
                    fcmOptions: {
                        link: 'https://your-app-url.com'
                    }
                }
            };
            
            await admin.messaging().send(message);
            
            // Update status to sent
            await snap.ref.update({ status: 'sent', sentAt: new Date().toISOString() });
            
            console.log('Notification sent successfully');
        } catch (error) {
            console.error('Error sending notification:', error);
            await snap.ref.update({ status: 'failed', error: error.message });
        }
    });

// Function to send announcement notifications
exports.sendAnnouncementNotification = functions.firestore
    .document('announcements/{announcementId}')
    .onCreate(async (snap, context) => {
        const announcement = snap.data();
        
        // Get all FCM tokens
        const tokensSnapshot = await admin.firestore().collection('fcmTokens').get();
        const tokens = tokensSnapshot.docs.map(doc => doc.data().token);
        
        if (tokens.length === 0) return;
        
        const message = {
            tokens: tokens,
            notification: {
                title: 'New Announcement',
                body: announcement.title
            },
            data: {
                type: 'announcement',
                announcementId: announcement.id,
                click_action: 'FLUTTER_NOTIFICATION_CLICK'
            }
        };
        
        try {
            await admin.messaging().sendMulticast(message);
            console.log('Announcement notification sent to', tokens.length, 'devices');
        } catch (error) {
            console.error('Error sending announcement notification:', error);
        }
    });
