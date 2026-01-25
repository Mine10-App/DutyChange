// server.js - Complete backend for PWA with push notifications
require('dotenv').config();
const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://www.gstatic.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://firestore.googleapis.com", "https://fcm.googleapis.com"],
    },
  },
}));

app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(bodyParser.json());
app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Load environment variables
const PORT = process.env.PORT || 3000;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'YOUR_VAPID_PUBLIC_KEY';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'YOUR_VAPID_PRIVATE_KEY';

// Configure web-push
webpush.setVapidDetails(
  'mailto:admin@dutymanager.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// In-memory storage (use database in production)
const subscriptions = new Map();
const pendingNotifications = new Map();
const userSessions = new Map();

// Database simulation
class InMemoryDB {
  constructor() {
    this.users = new Map();
    this.announcements = [];
    this.requests = [];
    this.roster = [];
    this.notificationLog = [];
  }
  
  // User management
  addUser(user) {
    const id = uuidv4();
    this.users.set(id, { ...user, id, createdAt: new Date() });
    return id;
  }
  
  getUser(id) {
    return this.users.get(id);
  }
  
  // Announcements
  addAnnouncement(announcement) {
    const id = uuidv4();
    const fullAnnouncement = {
      id,
      ...announcement,
      createdAt: new Date(),
      status: 'active'
    };
    this.announcements.unshift(fullAnnouncement);
    return fullAnnouncement;
  }
  
  // Request management
  addRequest(request) {
    const id = uuidv4();
    const fullRequest = {
      id,
      ...request,
      createdAt: new Date(),
      status: 'pending'
    };
    this.requests.push(fullRequest);
    return fullRequest;
  }
}

const db = new InMemoryDB();

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    subscriptions: subscriptions.size,
    memory: process.memoryUsage()
  });
});

// Get VAPID public key
app.get('/api/vapid-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Subscribe to push notifications
app.post('/api/push/subscribe', async (req, res) => {
  try {
    const { subscription, userId, deviceInfo } = req.body;
    
    if (!subscription || !userId) {
      return res.status(400).json({ error: 'Missing subscription or userId' });
    }
    
    // Store subscription
    const subId = uuidv4();
    subscriptions.set(userId, {
      id: subId,
      subscription,
      userId,
      deviceInfo: deviceInfo || {},
      subscribedAt: new Date(),
      lastActive: new Date()
    });
    
    console.log(`User ${userId} subscribed to push notifications`);
    
    // Send welcome notification
    setTimeout(() => {
      sendPushNotification(userId, {
        title: 'Welcome to Duty Manager',
        body: 'You will now receive real-time updates',
        data: { type: 'welcome', timestamp: new Date().toISOString() }
      }).catch(console.error);
    }, 2000);
    
    res.json({
      success: true,
      subscriptionId: subId,
      message: 'Subscribed successfully'
    });
    
  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// Unsubscribe from push notifications
app.post('/api/push/unsubscribe', (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }
  
  subscriptions.delete(userId);
  console.log(`User ${userId} unsubscribed`);
  
  res.json({ success: true, message: 'Unsubscribed successfully' });
});

// Send push notification to specific user
app.post('/api/push/send', async (req, res) => {
  try {
    const { userId, title, body, data, urgency = 'normal' } = req.body;
    
    if (!userId || !title) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await sendPushNotification(userId, {
      title,
      body,
      data: { ...data, urgency },
      requireInteraction: urgency === 'high'
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Send announcement to all users
app.post('/api/push/announcement', async (req, res) => {
  try {
    const { title, content, priority = 'medium', targetUsers = 'all' } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Missing title or content' });
    }
    
    // Store announcement in database
    const announcement = db.addAnnouncement({
      title,
      content,
      priority,
      targetUsers,
      createdBy: req.body.createdBy || 'System'
    });
    
    // Send to all subscribers
    const results = [];
    const promises = [];
    
    subscriptions.forEach((sub, userId) => {
      // Check if announcement is targeted to this user
      if (targetUsers === 'all' || 
          (Array.isArray(targetUsers) && targetUsers.includes(userId))) {
        
        const promise = sendPushNotification(userId, {
          title: `📢 ${title}`,
          body: content.length > 100 ? content.substring(0, 100) + '...' : content,
          data: {
            type: 'announcement',
            id: announcement.id,
            priority,
            timestamp: new Date().toISOString()
          },
          requireInteraction: priority === 'high'
        }).then(result => {
          results.push({ userId, success: true });
        }).catch(error => {
          results.push({ userId, success: false, error: error.message });
        });
        
        promises.push(promise);
      }
    });
    
    await Promise.all(promises);
    
    const successCount = results.filter(r => r.success).length;
    
    res.json({
      success: true,
      announcementId: announcement.id,
      sentTo: successCount,
      totalSubscribers: subscriptions.size,
      results: results
    });
    
  } catch (error) {
    console.error('Announcement error:', error);
    res.status(500).json({ error: 'Failed to send announcement' });
  }
});

// Send duty change request notification
app.post('/api/push/request', async (req, res) => {
  try {
    const { fromUserId, toUserId, requestType, details } = req.body;
    
    if (!fromUserId || !toUserId || !requestType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Store request in database
    const request = db.addRequest({
      fromUserId,
      toUserId,
      type: requestType,
      details,
      status: 'pending'
    });
    
    // Send notification to recipient
    const result = await sendPushNotification(toUserId, {
      title: requestType === 'dutyChange' ? '🔄 Duty Change Request' : '📅 Leave Request',
      body: `New ${requestType} request from user ${fromUserId}`,
      data: {
        type: 'request',
        requestId: request.id,
        requestType,
        fromUserId,
        timestamp: new Date().toISOString(),
        actionUrl: `/requests/${request.id}`
      },
      actions: [
        { action: 'accept', title: 'Accept' },
        { action: 'reject', title: 'Reject' },
        { action: 'view', title: 'View Details' }
      ],
      requireInteraction: true
    });
    
    res.json({
      success: true,
      requestId: request.id,
      notificationSent: result.success
    });
    
  } catch (error) {
    console.error('Request notification error:', error);
    res.status(500).json({ error: 'Failed to send request notification' });
  }
});

// Get user's pending notifications
app.get('/api/notifications/:userId', (req, res) => {
  const { userId } = req.params;
  const userNotifications = pendingNotifications.get(userId) || [];
  
  res.json({
    notifications: userNotifications,
    count: userNotifications.length
  });
});

// Mark notification as read
app.post('/api/notifications/:userId/read', (req, res) => {
  const { userId } = req.params;
  const { notificationId } = req.body;
  
  let userNotifications = pendingNotifications.get(userId) || [];
  userNotifications = userNotifications.filter(n => n.id !== notificationId);
  pendingNotifications.set(userId, userNotifications);
  
  res.json({ success: true });
});

// Get service worker update info
app.get('/api/sw-update', (req, res) => {
  const updateInfo = {
    version: process.env.APP_VERSION || '2.0.0',
    forceUpdate: false,
    changelog: [
      'Added push notifications',
      'Improved offline support',
      'Enhanced UI for mobile'
    ],
    timestamp: new Date().toISOString()
  };
  
  res.json(updateInfo);
});

// Get manifest with dynamic configuration
app.get('/manifest.json', (req, res) => {
  const manifest = {
    name: process.env.APP_NAME || 'Duty Manager',
    short_name: process.env.APP_SHORT_NAME || 'DutyMgr',
    description: process.env.APP_DESCRIPTION || 'Staff duty management system',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    background_color: '#f5f7fa',
    theme_color: '#3498db',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ]
  };
  
  res.json(manifest);
});

// Offline data sync endpoint
app.post('/api/sync', async (req, res) => {
  try {
    const { userId, offlineActions } = req.body;
    
    if (!userId || !Array.isArray(offlineActions)) {
      return res.status(400).json({ error: 'Invalid sync data' });
    }
    
    const results = [];
    
    // Process each offline action
    for (const action of offlineActions) {
      try {
        switch (action.type) {
          case 'leave_application':
            // Process leave application
            const leaveRequest = db.addRequest({
              ...action.data,
              syncStatus: 'synced',
              syncedAt: new Date()
            });
            results.push({ type: action.type, success: true, id: leaveRequest.id });
            break;
            
          case 'duty_change':
            // Process duty change
            const dutyRequest = db.addRequest({
              ...action.data,
              syncStatus: 'synced',
              syncedAt: new Date()
            });
            results.push({ type: action.type, success: true, id: dutyRequest.id });
            break;
            
          default:
            results.push({ type: action.type, success: false, error: 'Unknown action type' });
        }
      } catch (error) {
        results.push({ type: action.type, success: false, error: error.message });
      }
    }
    
    // Send sync completion notification
    await sendPushNotification(userId, {
      title: 'Sync Complete',
      body: `${results.filter(r => r.success).length} actions synced successfully`,
      data: { type: 'sync_complete', results }
    });
    
    res.json({
      success: true,
      syncedAt: new Date().toISOString(),
      results
    });
    
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// Admin endpoints (protected)
app.post('/api/admin/broadcast', async (req, res) => {
  // Add authentication in production
  const { message, title = 'Admin Announcement', target = 'all' } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  const results = [];
  const promises = [];
  
  subscriptions.forEach((sub, userId) => {
    if (target === 'all' || userId === target) {
      const promise = sendPushNotification(userId, {
        title: `👨‍💼 ${title}`,
        body: message,
        data: {
          type: 'admin_message',
          timestamp: new Date().toISOString()
        },
        requireInteraction: true
      }).then(() => {
        results.push({ userId, success: true });
      }).catch(error => {
        results.push({ userId, success: false, error: error.message });
      });
      
      promises.push(promise);
    }
  });
  
  await Promise.all(promises);
  
  res.json({
    success: true,
    sentTo: results.filter(r => r.success).length,
    results
  });
});

// Analytics endpoint
app.post('/api/analytics/event', (req, res) => {
  const { userId, event, data } = req.body;
  
  console.log(`Analytics: ${event} from ${userId}`, data);
  
  // In production, store in database
  db.notificationLog.push({
    id: uuidv4(),
    userId,
    event,
    data,
    timestamp: new Date().toISOString()
  });
  
  res.json({ success: true });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Helper function to send push notifications
async function sendPushNotification(userId, notification) {
  const subscriptionData = subscriptions.get(userId);
  
  if (!subscriptionData) {
    throw new Error(`User ${userId} not subscribed`);
  }
  
  try {
    await webpush.sendNotification(
      subscriptionData.subscription,
      JSON.stringify(notification)
    );
    
    // Log successful notification
    db.notificationLog.push({
      id: uuidv4(),
      userId,
      type: 'push_sent',
      notification,
      timestamp: new Date().toISOString()
    });
    
    return { success: true, sentAt: new Date().toISOString() };
    
  } catch (error) {
    console.error(`Failed to send notification to ${userId}:`, error);
    
    // Remove expired subscriptions
    if (error.statusCode === 410) {
      subscriptions.delete(userId);
      console.log(`Removed expired subscription for ${userId}`);
    }
    
    // Store failed notification for retry
    const failedId = uuidv4();
    let userFailed = pendingNotifications.get(userId) || [];
    userFailed.push({
      id: failedId,
      notification,
      attemptedAt: new Date(),
      error: error.message
    });
    pendingNotifications.set(userId, userFailed);
    
    return { success: false, error: error.message };
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║    Duty Manager PWA Server Running       ║
  ╠══════════════════════════════════════════╣
  ║  Port: ${PORT}                                ║
  ║  Environment: ${process.env.NODE_ENV || 'development'}                  ║
  ║  Subscribers: ${subscriptions.size}                          ║
  ║  VAPID Key: ${VAPID_PUBLIC_KEY.substring(0, 20)}...  ║
  ╚══════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  
  // Save state to database in production
  const state = {
    subscriptions: Array.from(subscriptions.entries()),
    timestamp: new Date().toISOString()
  };
  
  console.log('Saved state:', state);
  process.exit(0);
});

module.exports = app;
