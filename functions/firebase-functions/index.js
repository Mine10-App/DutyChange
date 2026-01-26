// firebase-functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Send notification when new announcement is created
exports.sendAnnouncementNotification = functions.firestore
  .document('announcements/{announcementId}')
  .onCreate(async (snapshot, context) => {
    const announcement = snapshot.data();
    
    // Get all user FCM tokens
    const tokensSnapshot = await admin.firestore().collection('fcmTokens').get();
    const tokens = [];
    
    tokensSnapshot.forEach(doc => {
      const tokenData = doc.data();
      if (tokenData.token) {
        tokens.push(tokenData.token);
      }
    });
    
    if (tokens.length === 0) {
      console.log('No FCM tokens found');
      return null;
    }
    
    // Create notification payload
    const payload = {
      notification: {
        title: 'New Announcement',
        body: announcement.title,
        icon: 'https://your-domain.com/icon-192x192.png',
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      data: {
        type: 'announcement',
        announcementId: announcement.id,
        priority: announcement.priority || 'medium',
        timestamp: new Date().toISOString()
      }
    };
    
    // Send to all tokens
    const response = await admin.messaging().sendToDevice(tokens, payload);
    
    // Cleanup failed tokens
    const failedTokens = [];
    response.results.forEach((result, index) => {
      const error = result.error;
      if (error) {
        console.error('Failure sending notification to', tokens[index], error);
        if (error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered') {
          failedTokens.push(tokensSnapshot.docs[index].ref);
        }
      }
    });
    
    // Delete failed tokens
    await Promise.all(failedTokens.map(tokenRef => tokenRef.delete()));
    
    return null;
  });

// Send notification when new duty change request is created
exports.sendDutyChangeNotification = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snapshot, context) => {
    const notification = snapshot.data();
    
    if (!notification.to || notification.status !== 'pending') {
      return null;
    }
    
    const payload = {
      notification: {
        title: notification.title || 'New Notification',
        body: notification.body || 'You have a new notification',
        icon: 'https://your-domain.com/icon-192x192.png'
      },
      data: {
        ...notification.data,
        notificationId: snapshot.id
      }
    };
    
    try {
      // Send notification
      const response = await admin.messaging().sendToDevice(notification.to, payload);
      console.log('Notification sent:', response);
      
      // Update notification status
      await snapshot.ref.update({
        status: 'sent',
        sentAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('Error sending notification:', error);
      await snapshot.ref.update({
        status: 'failed',
        error: error.message
      });
    }
    
    return null;
  });
