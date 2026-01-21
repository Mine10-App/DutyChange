// auth.js - Updated with proper SHA-256
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const errorDiv = document.getElementById('error');
    const loadingDiv = document.getElementById('loading');
    
    // Check if user is already logged in
    if(localStorage.getItem('currentUser')) {
        window.location.href = 'dashboard.html';
    }
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        // Show loading
        loadingDiv.style.display = 'block';
        errorDiv.style.display = 'none';
        
        // Hash the password properly
        try {
            const passwordHash = await sha256(password);
            const user = authenticateUser(username, passwordHash);
            
            if(user) {
                // Store user data in localStorage
                localStorage.setItem('currentUser', JSON.stringify(user));
                
                // Redirect to dashboard
                window.location.href = 'dashboard.html';
            } else {
                errorDiv.style.display = 'block';
                loadingDiv.style.display = 'none';
            }
        } catch (error) {
            console.error('Error during authentication:', error);
            errorDiv.textContent = 'Authentication error. Please try again.';
            errorDiv.style.display = 'block';
            loadingDiv.style.display = 'none';
        }
    });
    
    function authenticateUser(username, passwordHash) {
        // Find user in users array
        const user = users.find(u => 
            u.username.toLowerCase() === username.toLowerCase() && 
            u.passwordHash.toLowerCase() === passwordHash.toLowerCase()
        );
        
        return user;
    }
    
    // Proper SHA-256 function using Web Crypto API
    async function sha256(message) {
        // Convert message to Uint8Array
        const msgBuffer = new TextEncoder().encode(message);
        
        // Hash the message
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        
        // Convert ArrayBuffer to hex string
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return hashHex;
    }
    
    // Fallback for older browsers
    function sha256Fallback(message) {
        // Simple hash function (not cryptographically secure, but works for demo)
        let hash = 0;
        for (let i = 0; i < message.length; i++) {
            const char = message.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16);
    }
});
