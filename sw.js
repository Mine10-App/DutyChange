// sw.js
const CACHE_NAME = 'duty-manager-v1';

// Create a simple SVG icon as string
const iconSVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="45" fill="#3498db"/>
    <circle cx="50" cy="35" r="12" fill="white"/>
    <path d="M50,55 C65,55 70,70 70,70 L30,70 C30,70 35,55 50,55 Z" fill="white"/>
    <path d="M35,75 L65,75 L65,85 C65,90 60,95 50,95 C40,95 35,90 35,85 Z" fill="white"/>
    <path d="M20,20 L20,40 L30,30 Z" fill="#27ae60"/>
</svg>`;

const iconDataURI = 'data:image/svg+xml;base64,' + btoa(iconSVG);

self.addEventListener('push', event => {
    console.log('Push event received!');
    
    const data = event.data ? event.data.json() : {
        title: 'Duty Manager',
        body: 'You have a new notification'
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'Duty Manager', {
            body: data.body || 'New notification',
            icon: iconDataURI,
            badge: iconDataURI,
            vibrate: [200, 100, 200],
            data: data.data || {},
            tag: 'duty-notification'
        })
    );
});

self.addEventListener('notificationclick', event => {
    console.log('Notification clicked');
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow('/')
    );
});
