// dashboard.js - Complete working version
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    
    if(!currentUser) {
        window.location.href = 'index.html';
        return;
    }
    
    // Display user info
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userRole').textContent = currentUser.Level;
    document.getElementById('userRc').textContent = `RC No: ${currentUser.RCNo}`;
    
    // Logout functionality
    document.getElementById('logoutBtn').addEventListener('click', function() {
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    });
    
    // Load initial data
    loadCurrentDuty();
    loadDutyRequests();
    
    // Listen for real-time updates
    setupRealtimeListener();
    
    // Global functions
    window.acceptRequest = async function(requestId) {
        try {
            await db.collection('dutyRequests').doc(requestId).update({
                status: 'accepted',
                respondedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            alert('Request accepted successfully!');
            loadDutyRequests();
        } catch (error) {
            console.error('Error accepting request:', error);
            alert('Error accepting request');
        }
    };
    
    window.rejectRequest = async function(requestId) {
        try {
            await db.collection('dutyRequests').doc(requestId).update({
                status: 'rejected',
                respondedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            alert('Request rejected');
            loadDutyRequests();
        } catch (error) {
            console.error('Error rejecting request:', error);
            alert('Error rejecting request');
        }
    };
    
    window.createIndex = function() {
        const indexUrl = "https://console.firebase.google.com/v1/r/project/leelidc-1f753/firestore/indexes?create_composite=ClJwcm9qZWN0cy9sZWVsaWRjLTFmNzUzL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9kdXR5UmVxdWVzdHMvaW5kZXhlcy9fEAEaDAoIZnJvbVVzZXIQARoNCgl0aW1lc3RhbXAQAhoMCghfX25hbWVfXxAC";
        window.open(indexUrl, '_blank');
    };
    
    async function loadDutyRequests() {
        const requestsList = document.getElementById('requestsList');
        
        try {
            // First try: Simple query without complex ordering
            const querySnapshot = await db.collection('dutyRequests')
                .where('toUser', '==', currentUser.username)
                .get();
            
            if(querySnapshot.empty) {
                requestsList.innerHTML = '<div class="no-requests">No pending requests</div>';
                return;
            }
            
            // Filter for pending requests manually
            const pendingRequests = querySnapshot.docs.filter(doc => {
                const data = doc.data();
                return data.status === 'pending';
            });
            
            if(pendingRequests.length === 0) {
                requestsList.innerHTML = '<div class="no-requests">No pending requests</div>';
                return;
            }
            
            // Sort by timestamp manually
            pendingRequests.sort((a, b) => {
                const timeA = a.data().timestamp?.toDate() || new Date(0);
                const timeB = b.data().timestamp?.toDate() || new Date(0);
                return timeB - timeA;
            });
            
            displayRequests(pendingRequests);
            
        } catch (error) {
            console.error('Error loading requests:', error);
            
            // Show index warning for specific error
            if(error.code === 'failed-precondition') {
                document.getElementById('indexWarning').style.display = 'block';
                requestsList.innerHTML = `
                    <div class="no-requests">
                        <p>Firebase index required for optimal performance.</p>
                        <p><button onclick="createIndex()" style="background: #667eea; color: white; border: none; padding: 8px 16px; border-radius: 5px; margin-top: 10px; cursor: pointer;">
                            Create Index Now
                        </button></p>
                    </div>
                `;
            } else {
                requestsList.innerHTML = '<div class="no-requests">Error loading requests</div>';
            }
        }
    }
    
    function displayRequests(docs) {
        const requestsList = document.getElementById('requestsList');
        requestsList.innerHTML = '';
        
        docs.forEach(doc => {
            const request = doc.data();
            const requestDiv = document.createElement('div');
            requestDiv.className = 'request-item';
            requestDiv.innerHTML = `
                <div class="request-info">
                    <h4>Request from: ${request.fromName || 'Unknown'}</h4>
                    <div class="request-details">
                        <span>From Duty: ${request.fromTime || 'N/A'}</span>
                        <span>To Duty: ${request.toTime || 'N/A'}</span>
                        <span>Date: ${request.date || 'N/A'}</span>
                    </div>
                    <div class="request-details">
                        <span>From RC: ${request.fromRc || 'N/A'}</span>
                        <span>To RC: ${request.toRc || 'N/A'}</span>
                    </div>
                </div>
                <div class="request-actions">
                    <button class="btn btn-accept" onclick="acceptRequest('${doc.id}')">Accept</button>
                    <button class="btn btn-reject" onclick="rejectRequest('${doc.id}')">Reject</button>
                </div>
            `;
            requestsList.appendChild(requestDiv);
        });
    }
    
    function loadCurrentDuty() {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const formattedDate = now.toLocaleDateString('en-US', options);
        
        document.getElementById('currentDutyTime').textContent = '08:00 - 16:00';
        document.getElementById('currentDutyDate').textContent = formattedDate;
    }
    
    function setupRealtimeListener() {
        try {
            // Simple real-time listener for new requests
            db.collection('dutyRequests')
                .where('toUser', '==', currentUser.username)
                .onSnapshot(snapshot => {
                    const pendingRequests = snapshot.docs.filter(doc => 
                        doc.data().status === 'pending'
                    );
                    
                    if(pendingRequests.length > 0) {
                        displayRequests(pendingRequests);
                    } else {
                        const requestsList = document.getElementById('requestsList');
                        requestsList.innerHTML = '<div class="no-requests">No pending requests</div>';
                    }
                });
        } catch (error) {
            console.log('Realtime listener setup failed (non-critical):', error);
        }
    }
});
