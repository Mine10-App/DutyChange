// firebase/functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Listen for new announcements
exports.sendAnnouncementNotification = functions.firestore
  .document('announcements/{announcementId}')
  .onCreate(async (snapshot, context) => {
    const announcement = snapshot.data();
    
    // Get all user FCM tokens
    const tokensSnapshot = await admin.firestore()
      .collection('userTokens')
      .get();
    
    const tokens = [];
    tokensSnapshot.forEach(doc => {
      if (doc.data().token) {
        tokens.push(doc.data().token);
      }
    });
    
    if (tokens.length > 0) {
      const message = {
        notification: {
          title: '📢 New Announcement',
          body: announcement.title
        },
        data: {
          type: 'announcement',
          id: context.params.announcementId,
          priority: announcement.priority || 'medium',
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        },
        tokens: tokens
      };
      
      try {
        const response = await admin.messaging().sendMulticast(message);
        console.log('Announcement sent:', response.successCount + ' successful');
      } catch (error) {
        console.error('Error sending announcement:', error);
      }
    }
  });

// Listen for new duty change requests
exports.sendRequestNotification = functions.firestore
  .document('requests/{requestId}')
  .onCreate(async (snapshot, context) => {
    const request = snapshot.data();
    
    if (request.type === 'dutyChange' && request.status === 'pending') {
      // Get recipient's FCM token
      const tokenDoc = await admin.firestore()
        .collection('userTokens')
        .doc(request.toUsername)
        .get();
      
      if (tokenDoc.exists && tokenDoc.data().token) {
        const message = {
          notification: {
            title: '🔄 Duty Change Request',
            body: `${request.fromName} wants to swap duty on ${request.date}`
          },
          data: {
            type: 'request',
            requestId: context.params.requestId,
            from: request.fromUsername,
            click_action: 'FLUTTER_NOTIFICATION_CLICK'
          },
          token: tokenDoc.data().token
        };
        
        try {
          await admin.messaging().send(message);
          console.log('Request notification sent to:', request.toUsername);
        } catch (error) {
          console.error('Error sending request notification:', error);
        }
      }
    }
  });
