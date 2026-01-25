// server.js
const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// VAPID keys (generate using: web-push generate-vapid-keys)
const vapidKeys = {
  publicKey: 'YOUR_VAPID_PUBLIC_KEY',
  privateKey: 'YOUR_VAPID_PRIVATE_KEY'
};

webpush.setVapidDetails(
  'mailto:admin@yourdomain.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Store subscriptions in memory (use database in production)
const subscriptions = new Map();

// Subscribe endpoint
app.post('/api/push/subscribe', (req, res) => {
  const { subscription, userId, userRole } = req.body;
  
  subscriptions.set(userId, { subscription, userRole });
  res.status(200).json({ success: true });
});

// Send notification endpoint
app.post('/api/push/send', async (req, res) => {
  const { userId, title, body, data } = req.body;
  
  const userSubscription = subscriptions.get(userId);
  
  if (userSubscription) {
    try {
      await webpush.sendNotification(userSubscription.subscription, JSON.stringify({
        notification: { title, body },
        data: data
      }));
      res.json({ success: true });
    } catch (error) {
      console.error('Push notification failed:', error);
      res.status(500).json({ error: 'Failed to send notification' });
    }
  } else {
    res.status(404).json({ error: 'User not subscribed' });
  }
});

// Send announcement to all users
app.post('/api/push/announcement', async (req, res) => {
  const { title, body, priority } = req.body;
  
  const promises = [];
  subscriptions.forEach((data, userId) => {
    promises.push(
      webpush.sendNotification(data.subscription, JSON.stringify({
        notification: { title, body },
        data: { type: 'announcement', priority }
      })).catch(error => console.error(`Failed for ${userId}:`, error))
    );
  });
  
  await Promise.all(promises);
  res.json({ success: true, sentTo: subscriptions.size });
});

app.listen(3000, () => {
  console.log('Push notification server running on port 3000');
});
