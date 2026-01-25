const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.sendPushNotification = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snapshot, context) => {
    const notification = snapshot.data();
    
    // Get user's FCM token
    const userDeviceDoc = await admin.firestore()
      .collection('userDevices')
      .doc(notification.to)
      .get();
    
    if (!userDeviceDoc.exists) {
      console.log(`No device token found for user: ${notification.to}`);
      return null;
    }
    
    const deviceToken = userDeviceDoc.data().fcmToken;
    
    if (!deviceToken) {
      console.log(`No FCM token for user: ${notification.to}`);
      return null;
    }
    
    const message = {
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: notification.data || {},
      token: deviceToken
    };
    
    try {
      const response = await admin.messaging().send(message);
      console.log('Successfully sent message:', response);
      
      // Mark notification as sent
      await snapshot.ref.update({ sent: true, sentAt: new Date().toISOString() });
      
      return response;
    } catch (error) {
      console.error('Error sending message:', error);
      // Mark notification as failed
      await snapshot.ref.update({ 
        error: error.message, 
        failed: true,
        failedAt: new Date().toISOString() 
      });
      return null;
    }
  });

// Trigger for new requests
exports.notifyOnNewRequest = functions.firestore
  .document('requests/all')
  .onUpdate(async (change, context) => {
    const newRequests = change.after.data().requests;
    const oldRequests = change.before.data().requests;
    
    // Find newly added requests
    const newRequest = newRequests.find(newReq => 
      !oldRequests.some(oldReq => oldReq.id === newReq.id)
    );
    
    if (!newRequest) return null;
    
    // If it's a duty change, notify the recipient
    if (newRequest.type === 'dutyChange' && newRequest.status === 'pending') {
      const message = {
        notification: {
          title: 'Duty Change Request',
          body: `${newRequest.fromName} wants to swap duty with you on ${newRequest.date}`
        },
        data: {
          type: 'duty_change_request',
          requestId: newRequest.id,
          fromUser: newRequest.fromUsername,
          date: newRequest.date,
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        }
      };
      
      // Get recipient's device token
      const userDeviceDoc = await admin.firestore()
        .collection('userDevices')
        .doc(newRequest.toUsername)
        .get();
      
      if (userDeviceDoc.exists && userDeviceDoc.data().fcmToken) {
        message.token = userDeviceDoc.data().fcmToken;
        
        try {
          await admin.messaging().send(message);
          console.log('Notification sent for new duty change request');
        } catch (error) {
          console.error('Error sending notification:', error);
        }
      }
    }
    
    return null;
  });
