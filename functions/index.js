// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Send notification to specific user
exports.sendNotification = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snap, context) => {
    const notification = snap.data();
    
    // Get user's FCM token
    const userDoc = await admin.firestore()
      .collection('userTokens')
      .doc(notification.targetUser)
      .get();
    
    if (!userDoc.exists) return null;
    
    const userToken = userDoc.data().token;
    
    // Prepare message
    const message = {
      token: userToken,
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: notification.data || {},
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          color: '#3498db'
        }
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
    try {
      const response = await admin.messaging().send(message);
      console.log('Notification sent:', response);
      
      // Mark as delivered
      await snap.ref.update({ delivered: true });
      
    } catch (error) {
      console.error('Error sending notification:', error);
    }
    
    return null;
  });

// Send announcement to all users
exports.sendAnnouncement = functions.firestore
  .document('announcements/{announcementId}')
  .onCreate(async (snap, context) => {
    const announcement = snap.data();
    
    // Get all user tokens
    const tokensSnapshot = await admin.firestore()
      .collection('userTokens')
      .get();
    
    const tokens = [];
    tokensSnapshot.forEach(doc => {
      tokens.push(doc.data().token);
    });
    
    if (tokens.length === 0) return null;
    
    const message = {
      notification: {
        title: '📢 ' + announcement.title,
        body: announcement.content.substring(0, 100) + '...'
      },
      data: {
        type: 'announcement',
        id: announcement.id
      },
      tokens: tokens
    };
    
    try {
      const response = await admin.messaging().sendMulticast(message);
      console.log('Announcement sent to', response.successCount, 'users');
    } catch (error) {
      console.error('Error sending announcement:', error);
    }
    
    return null;
  });
