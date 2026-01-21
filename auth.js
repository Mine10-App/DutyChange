// auth.js
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const errorDiv = document.getElementById('error');
    const loadingDiv = document.getElementById('loading');
    
    // Check if user is already logged in
    if(localStorage.getItem('currentUser')) {
        window.location.href = 'dashboard.html';
    }
    
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        // Show loading
        loadingDiv.style.display = 'block';
        errorDiv.style.display = 'none';
        
        // Simulate API call delay
        setTimeout(() => {
            const user = authenticateUser(username, password);
            
            if(user) {
                // Store user data in localStorage
                localStorage.setItem('currentUser', JSON.stringify(user));
                
                // Redirect to dashboard
                window.location.href = 'dashboard.html';
            } else {
                errorDiv.style.display = 'block';
                loadingDiv.style.display = 'none';
            }
        }, 1000);
    });
    
    function authenticateUser(username, password) {
        // Hash the password (using simple SHA-256 simulation)
        const passwordHash = sha256(password);
        
        // Find user in users array
        const user = users.find(u => 
            u.username === username && u.passwordHash === passwordHash
        );
        
        return user;
    }
    
    // Simple SHA-256 function (for demo purposes)
    function sha256(str) {
        // This is a simplified version for demo
        // In production, use a proper SHA-256 library
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }
});
