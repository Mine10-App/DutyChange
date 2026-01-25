const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Send push notification when a new announcement is created
exports.onNewAnnouncement = functions.firestore
    .document('announcements/{announcementId}')
    .onCreate(async (snap, context) => {
        const announcement = snap.data();
        
        try {
            // Get all user tokens
            const tokensSnapshot = await admin.firestore()
                .collection('userTokens')
                .get();
            
            const tokens = [];
            tokensSnapshot.forEach(doc => {
                if (doc.data().fcmToken) {
                    tokens.push(doc.data().fcmToken);
                }
            });
            
            if (tokens.length === 0) {
                console.log('No FCM tokens found');
                return;
            }
            
            // Prepare notification message
            const message = {
                notification: {
                    title: '📢 New Announcement',
                    body: announcement.title,
                    icon: '/icon.png'
                },
                data: {
                    type: 'announcement',
                    id: announcement.id || '',
                    title: announcement.title || '',
                    createdAt: announcement.createdAt || new Date().toISOString()
                },
                tokens: tokens,
                android: {
                    priority: 'high'
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default',
                            badge: 1
                        }
                    }
                }
            };
            
            // Send notification
            const response = await admin.messaging().sendMulticast(message);
            console.log('Announcement notification sent:', response.successCount, 'successful');
            
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

// Send push notification when a new duty change request is created
exports.onNewDutyChangeRequest = functions.firestore
    .document('requests/{requestId}')
    .onCreate(async (snap, context) => {
        const request = snap.data();
        
        // Only send for duty change requests
        if (request.type !== 'dutyChange' || request.status !== 'pending') {
            return;
        }
        
        try {
            // Get recipient's FCM token
            const tokenDoc = await admin.firestore()
                .collection('userTokens')
                .doc(request.toUsername)
                .get();
            
            if (!tokenDoc.exists || !tokenDoc.data().fcmToken) {
                console.log('No FCM token for user:', request.toUsername);
                return;
            }
            
            const token = tokenDoc.data().fcmToken;
            
            // Prepare notification message
            const message = {
                notification: {
                    title: '🔄 Duty Change Request',
                    body: `${request.fromName} wants to swap duty on ${request.date}`,
                    icon: '/icon.png'
                },
                data: {
                    type: 'duty_change_request',
                    id: request.id || '',
                    fromName: request.fromName || '',
                    date: request.date || '',
                    timestamp: request.timestamp || new Date().toISOString()
                },
                token: token,
                android: {
                    priority: 'high'
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default',
                            badge: 1
                        }
                    }
                }
            };
            
            // Send notification
            await admin.messaging().send(message);
            console.log('Duty change request notification sent to:', request.toUsername);
            
        } catch (error) {
            console.error('Error sending duty change notification:', error);
        }
    });

// Send push notification when a request is responded to
exports.onRequestResponse = functions.firestore
    .document('requests/{requestId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();
        
        // Only send if status changed from pending
        if (before.status === 'pending' && after.status !== 'pending') {
            try {
                // Get requester's FCM token
                const tokenDoc = await admin.firestore()
                    .collection('userTokens')
                    .doc(after.fromUsername)
                    .get();
                
                if (!tokenDoc.exists || !tokenDoc.data().fcmToken) {
                    console.log('No FCM token for user:', after.fromUsername);
                    return;
                }
                
                const token = tokenDoc.data().fcmToken;
                
                // Prepare notification message
                const message = {
                    notification: {
                        title: after.status === 'approved' ? '✅ Request Approved' : '❌ Request Rejected',
                        body: `${after.respondedBy || 'Supervisor'} ${after.status} your request`,
                        icon: '/icon.png'
                    },
                    data: {
                        type: 'request_response',
                        id: after.id || '',
                        status: after.status || '',
                        responder: after.respondedBy || '',
                        respondedAt: after.respondedAt || new Date().toISOString()
                    },
                    token: token,
                    android: {
                        priority: 'high'
                    },
                    apns: {
                        payload: {
                            aps: {
                                sound: 'default',
                                badge: 1
                            }
                        }
                    }
                };
                
                // Send notification
                await admin.messaging().send(message);
                console.log('Request response notification sent to:', after.fromUsername);
                
            } catch (error) {
                console.error('Error sending request response notification:', error);
            }
        }
    });
