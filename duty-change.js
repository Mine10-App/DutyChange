// duty-change.js
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    
    if(!currentUser) {
        window.location.href = 'index.html';
        return;
    }
    
    // Display current user info
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userRole').textContent = currentUser.Level;
    document.getElementById('currentUserName').textContent = currentUser.name;
    document.getElementById('currentUserRc').textContent = currentUser.RCNo;
    
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dutyDate').value = today;
    document.getElementById('dutyDate').min = today;
    
    // Logout functionality
    document.getElementById('logoutBtn').addEventListener('click', function() {
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    });
    
    // Load staff members for dropdown
    loadStaffMembers();
    
    // Update RC number when staff is selected
    document.getElementById('staffSelect').addEventListener('change', function() {
        const selectedUsername = this.value;
        const selectedUser = users.find(user => user.username === selectedUsername);
        
        if(selectedUser) {
            document.getElementById('staffRcDisplay').textContent = selectedUser.RCNo;
        } else {
            document.getElementById('staffRcDisplay').textContent = '-';
        }
    });
    
    // Form submission
    document.getElementById('dutyChangeForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const selectedUsername = document.getElementById('staffSelect').value;
        const selectedUser = users.find(user => user.username === selectedUsername);
        
        if(!selectedUser) {
            alert('Please select a valid staff member');
            return;
        }
        
        const dutyChangeData = {
            fromUser: currentUser.username,
            fromName: currentUser.name,
            fromRc: currentUser.RCNo,
            fromTime: document.getElementById('currentDutyTime').value,
            toUser: selectedUser.username,
            toName: selectedUser.name,
            toRc: selectedUser.RCNo,
            toTime: document.getElementById('requestedDutyTime').value,
            date: document.getElementById('dutyDate').value,
            status: 'pending',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Show loading
        document.getElementById('loading').style.display = 'block';
        document.getElementById('successMessage').style.display = 'none';
        document.getElementById('errorMessage').style.display = 'none';
        
        // Save to Firebase
        db.collection('dutyRequests').add(dutyChangeData)
            .then(docRef => {
                console.log('Document written with ID: ', docRef.id);
                document.getElementById('loading').style.display = 'none';
                document.getElementById('successMessage').style.display = 'block';
                
                // Reset form
                setTimeout(() => {
                    document.getElementById('dutyChangeForm').reset();
                    document.getElementById('staffRcDisplay').textContent = '-';
                    document.getElementById('successMessage').style.display = 'none';
                }, 3000);
            })
            .catch(error => {
                console.error('Error adding document: ', error);
                document.getElementById('loading').style.display = 'none';
                document.getElementById('errorMessage').style.display = 'block';
            });
    });
    
    function loadStaffMembers() {
        const staffSelect = document.getElementById('staffSelect');
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        
        // Clear existing options except the first one
        while(staffSelect.options.length > 1) {
            staffSelect.remove(1);
        }
        
        // Filter out current user and add other users
        users.forEach(user => {
            if(user.username !== currentUser.username) {
                const option = document.createElement('option');
                option.value = user.username;
                option.textContent = `${user.name} (${user.RCNo}) - ${user.Level}`;
                staffSelect.appendChild(option);
            }
        });
    }
});
