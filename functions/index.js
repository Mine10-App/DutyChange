const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Cloud Function to send notifications
exports.sendNotification = functions.https.onCall(async (data, context) => {
    // Check if user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    
    const { to, title, body, data: notificationData } = data;
    
    try {
        // Get FCM token for the user
        const tokenDoc = await admin.firestore().collection('fcmTokens').doc(to).get();
        
        if (!tokenDoc.exists) {
            return { success: false, message: 'User has no FCM token' };
        }
        
        const tokenData = tokenDoc.data();
        
        // Prepare notification message
        const message = {
            token: tokenData.token,
            notification: {
                title: title,
                body: body
            },
            data: {
                ...notificationData,
                click_action: 'FLUTTER_NOTIFICATION_CLICK',
                icon: '/icon-192x192.png'
            },
            webpush: {
                notification: {
                    icon: '/icon-192x192.png',
                    badge: '/icon-72x72.png',
                    vibrate: [200, 100, 200]
                },
                fcmOptions: {
                    link: 'https://your-firebase-app.web.app' // Your Firebase Hosting URL
                }
            }
        };
        
        // Send notification
        const response = await admin.messaging().send(message);
        console.log('Successfully sent message:', response);
        
        return { success: true, messageId: response };
    } catch (error) {
        console.error('Error sending notification:', error);
        throw new functions.https.HttpsError('internal', 'Failed to send notification');
    }
});

// Function to send announcement notifications
exports.sendAnnouncementNotification = functions.firestore
    .document('announcements/{announcementId}')
    .onCreate(async (snap, context) => {
        const announcement = snap.data();
        
        // Get all FCM tokens
        const tokensSnapshot = await admin.firestore().collection('fcmTokens').get();
        
        if (tokensSnapshot.empty) {
            console.log('No FCM tokens found');
            return;
        }
        
        const tokens = tokensSnapshot.docs.map(doc => doc.data().token);
        
        // Prepare multicast message
        const message = {
            notification: {
                title: '📢 New Announcement',
                body: announcement.title
            },
            data: {
                type: 'announcement',
                announcementId: announcement.id,
                title: announcement.title,
                body: announcement.content,
                priority: announcement.priority || 'medium',
                click_action: 'FLUTTER_NOTIFICATION_CLICK'
            },
            webpush: {
                notification: {
                    icon: '/icon-192x192.png',
                    badge: '/icon-72x72.png',
                    vibrate: [200, 100, 200]
                },
                fcmOptions: {
                    link: 'https://your-firebase-app.web.app'
                }
            },
            tokens: tokens
        };
        
        try {
            const response = await admin.messaging().sendMulticast(message);
            console.log(`Successfully sent announcement to ${response.successCount} devices`);
            
            if (response.failureCount > 0) {
                const failedTokens = [];
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        failedTokens.push(tokens[idx]);
                    }
                });
                console.log('List of tokens that caused failures:', failedTokens);
            }
        } catch (error) {
            console.error('Error sending announcement notification:', error);
        }
    });

// Function to send duty change notifications
exports.sendDutyChangeNotification = functions.firestore
    .document('requests/{requestId}')
    .onCreate(async (snap, context) => {
        const request = snap.data();
        
        // Only handle duty change requests
        if (request.type !== 'dutyChange' || request.status !== 'pending') {
            return;
        }
        
        // Get recipient's FCM token
        const tokenDoc = await admin.firestore().collection('fcmTokens').doc(request.toUsername).get();
        
        if (!tokenDoc.exists) {
            console.log('Recipient has no FCM token');
            return;
        }
        
        const tokenData = tokenDoc.data();
        
        // Prepare notification message
        const message = {
            token: tokenData.token,
            notification: {
                title: '🔄 Duty Change Request',
                body: `${request.fromName} wants to swap duty with you on ${request.date}`
            },
            data: {
                type: 'duty_change',
                requestId: request.id,
                fromName: request.fromName,
                date: request.date,
                dutyTime: request.dutyTime,
                toDutyTime: request.toDutyTime,
                click_action: 'FLUTTER_NOTIFICATION_CLICK'
            },
            webpush: {
                notification: {
                    icon: '/icon-192x192.png',
                    badge: '/icon-72x72.png',
                    vibrate: [200, 100, 200]
                },
                fcmOptions: {
                    link: 'https://your-firebase-app.web.app'
                }
            }
        };
        
        try {
            await admin.messaging().send(message);
            console.log('Duty change notification sent successfully');
        } catch (error) {
            console.error('Error sending duty change notification:', error);
        }
    });
