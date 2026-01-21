// dashboard.js
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
    
    // Load duty requests
    loadDutyRequests();
    
    // Listen for real-time updates
    listenForRequests();
    
    function loadDutyRequests() {
        const requestsList = document.getElementById('requestsList');
        requestsList.innerHTML = '<div class="no-requests">Loading requests...</div>';
        
        db.collection('dutyRequests')
            .where('toUser', '==', currentUser.username)
            .where('status', '==', 'pending')
            .orderBy('timestamp', 'desc')
            .get()
            .then(snapshot => {
                if(snapshot.empty) {
                    requestsList.innerHTML = '<div class="no-requests">No pending requests</div>';
                    return;
                }
                
                requestsList.innerHTML = '';
                snapshot.forEach(doc => {
                    const request = doc.data();
                    displayRequest(doc.id, request);
                });
            })
            .catch(error => {
                console.error('Error loading requests:', error);
                requestsList.innerHTML = '<div class="no-requests">Error loading requests</div>';
            });
    }
    
    function displayRequest(requestId, request) {
        const requestsList = document.getElementById('requestsList');
        
        const requestDiv = document.createElement('div');
        requestDiv.className = 'request-item';
        requestDiv.innerHTML = `
            <div class="request-info">
                <h4>Request from: ${request.fromName}</h4>
                <div class="request-details">
                    <span>From: ${request.fromTime}</span>
                    <span>To: ${request.toTime}</span>
                    <span>Date: ${new Date(request.date).toLocaleDateString()}</span>
                </div>
                <div class="request-details">
                    <span>From RC: ${request.fromRc}</span>
                    <span>To RC: ${request.toRc}</span>
                </div>
            </div>
            <div class="request-actions">
                <button class="btn btn-accept" onclick="acceptRequest('${requestId}')">Accept</button>
                <button class="btn btn-reject" onclick="rejectRequest('${requestId}')">Reject</button>
            </div>
        `;
        
        requestsList.appendChild(requestDiv);
    }
    
    window.acceptRequest = function(requestId) {
        db.collection('dutyRequests').doc(requestId).update({
            status: 'accepted',
            respondedAt: firebase.firestore.FieldValue.serverTimestamp()
        })
        .then(() => {
            alert('Request accepted successfully!');
            loadDutyRequests();
        })
        .catch(error => {
            console.error('Error accepting request:', error);
            alert('Error accepting request');
        });
    };
    
    window.rejectRequest = function(requestId) {
        db.collection('dutyRequests').doc(requestId).update({
            status: 'rejected',
            respondedAt: firebase.firestore.FieldValue.serverTimestamp()
        })
        .then(() => {
            alert('Request rejected');
            loadDutyRequests();
        })
        .catch(error => {
            console.error('Error rejecting request:', error);
            alert('Error rejecting request');
        });
    };
    
    function listenForRequests() {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        
        db.collection('dutyRequests')
            .where('toUser', '==', currentUser.username)
            .where('status', '==', 'pending')
            .onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    if(change.type === 'added') {
                        // New request added
                        loadDutyRequests();
                    }
                });
            });
    }
});
