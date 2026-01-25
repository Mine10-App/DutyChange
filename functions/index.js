// firebase/functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const webpush = require('web-push');

// Initialize Firebase Admin
admin.initializeApp();

// Initialize web-push with VAPID keys
webpush.setVapidDetails(
  'mailto:notifications@dutymanager.com',
  functions.config().vapid.public,
  functions.config().vapid.private
);

// Store for managing subscriptions (use Firestore in production)
const pushSubscriptions = new Map();

/**
 * 1. Listen for new announcements and notify all users
 */
exports.onNewAnnouncement = functions.firestore
  .document('announcements/{announcementId}')
  .onCreate(async (snapshot, context) => {
    const announcement = snapshot.data();
    const announcementId = context.params.announcementId;
    
    console.log(`New announcement: ${announcement.title}`);
    
    // Get all users who should receive this announcement
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .where('notificationPreferences.announcements', '==', true)
      .get();
    
    const notifications = [];
    
    usersSnapshot.forEach(userDoc => {
      const user = userDoc.data();
      const userSubscription = user.pushSubscription;
      
      if (userSubscription && 
          (announcement.target === 'all' || 
           announcement.targetUsers?.includes(userDoc.id))) {
        
        notifications.push({
          to: userSubscription,
          title: `📢 ${announcement.title}`,
          body: announcement.content.length > 100 
            ? announcement.content.substring(0, 100) + '...'
            : announcement.content,
          data: {
            type: 'announcement',
            id: announcementId,
            priority: announcement.priority || 'medium',
            timestamp: new Date().toISOString(),
            action: 'view_announcement'
          },
          badge: '/badge.png',
          icon: '/icon-192x192.png',
          vibrate: [200, 100, 200]
        });
      }
    });
    
    // Send batch notifications
    const results = await sendBatchNotifications(notifications);
    
    // Log the notification send
    await admin.firestore().collection('notificationLogs').add({
      type: 'announcement',
      announcementId,
      sentAt: new Date().toISOString(),
      totalUsers: usersSnapshot.size,
      sentTo: results.successCount,
      failed: results.failedCount,
      priority: announcement.priority
    });
    
    return results;
  });

/**
 * 2. Listen for new duty change requests
 */
exports.onNewDutyChangeRequest = functions.firestore
  .document('dutyChangeRequests/{requestId}')
  .onCreate(async (snapshot, context) => {
    const request = snapshot.data();
    const requestId = context.params.requestId;
    
    console.log(`New duty change request: ${requestId}`);
    
    // Get recipient's notification preferences
    const recipientDoc = await admin.firestore()
      .collection('users')
      .doc(request.toUserId)
      .get();
    
    if (!recipientDoc.exists) {
      console.log(`Recipient ${request.toUserId} not found`);
      return null;
    }
    
    const recipient = recipientDoc.data();
    
    if (!recipient.pushSubscription || 
        !recipient.notificationPreferences?.dutyChangeRequests) {
      console.log(`Recipient ${request.toUserId} not subscribed to duty change notifications`);
      return null;
    }
    
    // Get requester's info
    const requesterDoc = await admin.firestore()
      .collection('users')
      .doc(request.fromUserId)
      .get();
    
    const requester = requesterDoc.exists ? requesterDoc.data() : { name: 'Unknown' };
    
    // Send notification
    const notification = {
      to: recipient.pushSubscription,
      title: '🔄 Duty Change Request',
      body: `${requester.name} wants to swap duty on ${request.date}`,
      data: {
        type: 'duty_change_request',
        requestId,
        fromUserId: request.fromUserId,
        date: request.date,
        timestamp: new Date().toISOString(),
        action: 'view_request'
      },
      actions: [
        { action: 'accept', title: 'Accept' },
        { action: 'reject', title: 'Reject' }
      ],
      requireInteraction: true,
      badge: '/badge.png',
      icon: '/icon-192x192.png'
    };
    
    try {
      await webpush.sendNotification(notification.to, JSON.stringify(notification));
      
      // Update request with notification sent status
      await snapshot.ref.update({
        notificationSent: true,
        notificationSentAt: new Date().toISOString()
      });
      
      console.log(`Notification sent for request ${requestId}`);
      
    } catch (error) {
      console.error(`Failed to send notification for request ${requestId}:`, error);
      
      // Update request with failed notification
      await snapshot.ref.update({
        notificationSent: false,
        notificationError: error.message
      });
    }
    
    return { success: true };
  });

/**
 * 3. Listen for new leave applications (for supervisors)
 */
exports.onNewLeaveApplication = functions.firestore
  .document('leaveApplications/{applicationId}')
  .onCreate(async (snapshot, context) => {
    const application = snapshot.data();
    const applicationId = context.params.applicationId;
    
    console.log(`New leave application: ${applicationId}`);
    
    // Get all supervisors
    const supervisorsSnapshot = await admin.firestore()
      .collection('users')
      .where('role', '==', 'supervisor')
      .where('notificationPreferences.leaveApplications', '==', true)
      .get();
    
    // Get applicant's info
    const applicantDoc = await admin.firestore()
      .collection('users')
      .doc(application.userId)
      .get();
    
    const applicant = applicantDoc.exists ? applicantDoc.data() : { name: 'Unknown' };
    
    const notifications = [];
    
    supervisorsSnapshot.forEach(supervisorDoc => {
      const supervisor = supervisorDoc.data();
      
      if (supervisor.pushSubscription) {
        notifications.push({
          to: supervisor.pushSubscription,
          title: '📅 New Leave Application',
          body: `${applicant.name} applied for ${application.leaveType} on ${application.date}`,
          data: {
            type: 'leave_application',
            applicationId,
            userId: application.userId,
            leaveType: application.leaveType,
            date: application.date,
            timestamp: new Date().toISOString(),
            action: 'review_leave'
          },
          actions: [
            { action: 'approve', title: 'Approve' },
            { action: 'reject', title: 'Reject' }
          ],
          requireInteraction: true,
          badge: '/badge.png',
          icon: '/icon-192x192.png'
        });
      }
    });
    
    // Send batch notifications to supervisors
    const results = await sendBatchNotifications(notifications);
    
    // Log the notification send
    await admin.firestore().collection('notificationLogs').add({
      type: 'leave_application',
      applicationId,
      sentAt: new Date().toISOString(),
      supervisorsCount: supervisorsSnapshot.size,
      sentTo: results.successCount,
      failed: results.failedCount
    });
    
    return results;
  });

/**
 * 4. Listen for request status changes
 */
exports.onRequestStatusChange = functions.firestore
  .document('requests/{requestId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const requestId = context.params.requestId;
    
    // Check if status changed from pending
    if (before.status === 'pending' && after.status !== 'pending') {
      console.log(`Request ${requestId} status changed to ${after.status}`);
      
      // Get the user who made the request
      const userDoc = await admin.firestore()
        .collection('users')
        .doc(after.fromUserId)
        .get();
      
      if (!userDoc.exists) {
        console.log(`User ${after.fromUserId} not found`);
        return null;
      }
      
      const user = userDoc.data();
      
      if (!user.pushSubscription || 
          !user.notificationPreferences?.requestUpdates) {
        console.log(`User ${after.fromUserId} not subscribed to request updates`);
        return null;
      }
      
      // Get responder's info
      const responderDoc = await admin.firestore()
        .collection('users')
        .doc(after.respondedBy)
        .get();
      
      const responder = responderDoc.exists ? responderDoc.data() : { name: 'Supervisor' };
      
      // Send notification to requester
      const notification = {
        to: user.pushSubscription,
        title: after.status === 'approved' ? '✅ Request Approved' : '❌ Request Rejected',
        body: `${responder.name} ${after.status} your ${after.type} request`,
        data: {
          type: 'request_status_update',
          requestId,
          status: after.status,
          timestamp: new Date().toISOString(),
          action: 'view_request'
        },
        badge: '/badge.png',
        icon: '/icon-192x192.png'
      };
      
      try {
        await webpush.sendNotification(notification.to, JSON.stringify(notification));
        
        console.log(`Status update notification sent for request ${requestId}`);
        
      } catch (error) {
        console.error(`Failed to send status update for request ${requestId}:`, error);
      }
    }
    
    return { success: true };
  });

/**
 * 5. Scheduled function to send daily duty reminders
 */
exports.sendDailyDutyReminders = functions.pubsub
  .schedule('0 7 * * *') // Every day at 7 AM
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    console.log('Running daily duty reminders...');
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Get today's roster
    const rosterSnapshot = await admin.firestore()
      .collection('dutyRoster')
      .doc(todayStr)
      .get();
    
    if (!rosterSnapshot.exists) {
      console.log(`No roster found for ${todayStr}`);
      return null;
    }
    
    const roster = rosterSnapshot.data();
    const notifications = [];
    
    // For each user with duty today
    for (const [userId, dutyTime] of Object.entries(roster)) {
      if (dutyTime && dutyTime !== 'Off') {
        // Get user's notification preferences
        const userDoc = await admin.firestore()
          .collection('users')
          .doc(userId)
          .get();
        
        if (userDoc.exists) {
          const user = userDoc.data();
          
          if (user.pushSubscription && 
              user.notificationPreferences?.dutyReminders) {
            
            notifications.push({
              to: user.pushSubscription,
              title: '📋 Today\'s Duty',
              body: `Your duty today: ${dutyTime}`,
              data: {
                type: 'duty_reminder',
                date: todayStr,
                dutyTime,
                timestamp: new Date().toISOString(),
                action: 'view_roster'
              },
              badge: '/badge.png',
              icon: '/icon-192x192.png'
            });
          }
        }
      }
    }
    
    // Send batch notifications
    const results = await sendBatchNotifications(notifications);
    
    // Log the reminder send
    await admin.firestore().collection('notificationLogs').add({
      type: 'duty_reminder',
      date: todayStr,
      sentAt: new Date().toISOString(),
      totalUsers: Object.keys(roster).length,
      sentTo: results.successCount,
      failed: results.failedCount
    });
    
    console.log(`Daily reminders sent: ${results.successCount} successful`);
    
    return results;
  });

/**
 * 6. HTTP endpoint for sending custom notifications (for admin)
 */
exports.sendCustomNotification = functions.https.onRequest(async (req, res) => {
  // Add authentication in production
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }
  
  try {
    const { title, body, targetUsers, data, priority = 'normal' } = req.body;
    
    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required' });
    }
    
    let usersQuery = admin.firestore().collection('users');
    
    if (targetUsers && targetUsers !== 'all') {
      if (Array.isArray(targetUsers)) {
        usersQuery = usersQuery.where(admin.firestore.FieldPath.documentId(), 'in', targetUsers);
      } else {
        usersQuery = usersQuery.where('role', '==', targetUsers);
      }
    }
    
    const usersSnapshot = await usersQuery.get();
    const notifications = [];
    
    usersSnapshot.forEach(userDoc => {
      const user = userDoc.data();
      
      if (user.pushSubscription) {
        notifications.push({
          to: user.pushSubscription,
          title,
          body,
          data: {
            type: 'custom_notification',
            ...data,
            timestamp: new Date().toISOString()
          },
          requireInteraction: priority === 'high',
          badge: '/badge.png',
          icon: '/icon-192x192.png'
        });
      }
    });
    
    const results = await sendBatchNotifications(notifications);
    
    res.json({
      success: true,
      message: 'Notification sent',
      totalUsers: usersSnapshot.size,
      sentTo: results.successCount,
      failed: results.failedCount,
      results: results.details
    });
    
  } catch (error) {
    console.error('Custom notification error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

/**
 * 7. HTTP endpoint for user subscription management
 */
exports.manageSubscription = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }
  
  try {
    const { action, userId, subscription, notificationPreferences } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const userRef = admin.firestore().collection('users').doc(userId);
    
    switch (action) {
      case 'subscribe':
        if (!subscription) {
          return res.status(400).json({ error: 'Subscription is required' });
        }
        
        await userRef.set({
          pushSubscription: subscription,
          notificationPreferences: notificationPreferences || {
            announcements: true,
            dutyChangeRequests: true,
            leaveApplications: true,
            requestUpdates: true,
            dutyReminders: true
          },
          lastSubscribed: new Date().toISOString()
        }, { merge: true });
        
        res.json({ success: true, message: 'Subscribed successfully' });
        break;
        
      case 'unsubscribe':
        await userRef.update({
          pushSubscription: admin.firestore.FieldValue.delete(),
          lastUnsubscribed: new Date().toISOString()
        });
        
        res.json({ success: true, message: 'Unsubscribed successfully' });
        break;
        
      case 'updatePreferences':
        if (!notificationPreferences) {
          return res.status(400).json({ error: 'Preferences are required' });
        }
        
        await userRef.update({
          notificationPreferences,
          preferencesUpdated: new Date().toISOString()
        });
        
        res.json({ success: true, message: 'Preferences updated' });
        break;
        
      default:
        res.status(400).json({ error: 'Invalid action' });
    }
    
  } catch (error) {
    console.error('Subscription management error:', error);
    res.status(500).json({ error: 'Operation failed' });
  }
});

/**
 * Helper function to send batch notifications
 */
async function sendBatchNotifications(notifications) {
  const results = {
    successCount: 0,
    failedCount: 0,
    details: []
  };
  
  const promises = notifications.map(async (notification, index) => {
    try {
      await webpush.sendNotification(notification.to, JSON.stringify(notification));
      results.successCount++;
      results.details.push({ index, success: true });
    } catch (error) {
      console.error(`Notification ${index} failed:`, error);
      results.failedCount++;
      results.details.push({ index, success: false, error: error.message });
      
      // Remove expired subscriptions
      if (error.statusCode === 410 || error.statusCode === 404) {
        // In production, update user's subscription status in Firestore
        console.log(`Subscription expired for notification ${index}`);
      }
    }
  });
  
  await Promise.allSettled(promises);
  
  return results;
}

/**
 * Clean up expired notifications (runs daily)
 */
exports.cleanupNotificationLogs = functions.pubsub
  .schedule('0 0 * * *') // Every day at midnight
  .timeZone('UTC')
  .onRun(async (context) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const logsSnapshot = await admin.firestore()
      .collection('notificationLogs')
      .where('sentAt', '<', thirtyDaysAgo.toISOString())
      .get();
    
    const batch = admin.firestore().batch();
    let deletedCount = 0;
    
    logsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });
    
    if (deletedCount > 0) {
      await batch.commit();
      console.log(`Cleaned up ${deletedCount} old notification logs`);
    }
    
    return { deletedCount };
  });
