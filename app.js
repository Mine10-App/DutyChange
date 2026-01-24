class ReservationSystem {
    constructor() {
        this.currentUser = null;
        this.db = firebase.firestore();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuth();
    }

    setupEventListeners() {
        // Login
        document.getElementById('loginBtn').addEventListener('click', () => this.login());
        
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        
        // Forms
        document.getElementById('reservationForm').addEventListener('submit', (e) => this.saveReservation(e));
        
        // Filters
        document.getElementById('checkinDateFilter').addEventListener('change', () => this.loadCheckinData());
        document.getElementById('checkoutDateFilter').addEventListener('change', () => this.loadCheckoutData());
        document.getElementById('generateReportBtn').addEventListener('click', () => this.generateReport());
        
        // Tab change events
        document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
            tab.addEventListener('shown.bs.tab', (e) => {
                if (e.target.getAttribute('href') === '#checkinTab') {
                    this.loadCheckinData();
                } else if (e.target.getAttribute('href') === '#checkoutTab') {
                    this.loadCheckoutData();
                } else if (e.target.getAttribute('href') === '#reportTab') {
                    this.loadFlightOptions('reportFlightFilter');
                }
            });
        });
    }

    checkAuth() {
        // Check if user is already logged in (from localStorage)
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.showDashboard();
        }
    }

    login() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        // Hash the password (simple SHA-256 simulation - in production use proper hashing)
        const hashedPassword = this.hashPassword(password);
        
        // Find user in users array (from user.js)
        const user = users.find(u => u.username === username && u.passwordHash === hashedPassword);
        
        if (user) {
            this.currentUser = user;
            localStorage.setItem('currentUser', JSON.stringify(user));
            this.showDashboard();
            this.hideError();
        } else {
            this.showError('Invalid username or password');
        }
    }

    hashPassword(password) {
        // Simple SHA-256 hash simulation
        // In production, use proper hashing with salt
        const sha256 = str => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return Math.abs(hash).toString(16);
        };
        return sha256(password);
    }

    showError(message) {
        const errorDiv = document.getElementById('loginError');
        errorDiv.textContent = message;
        errorDiv.classList.remove('d-none');
    }

    hideError() {
        document.getElementById('loginError').classList.add('d-none');
    }

    showDashboard() {
        document.getElementById('loginScreen').classList.add('d-none');
        document.getElementById('dashboard').classList.remove('d-none');
        
        // Display user info
        document.getElementById('userName').textContent = this.currentUser.name;
        document.getElementById('userLevel').textContent = this.currentUser.Level;
        document.getElementById('userRC').textContent = this.currentUser.RCNo;
        
        // Set default dates
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('reservationDate').value = today;
        document.getElementById('checkinDateFilter').value = today;
        document.getElementById('checkoutDateFilter').value = today;
        
        // Load flight options for filters
        this.loadFlightOptions('checkinFlightFilter');
        this.loadFlightOptions('checkoutFlightFilter');
        this.loadFlightOptions('reportFlightFilter');
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        document.getElementById('dashboard').classList.add('d-none');
        document.getElementById('loginScreen').classList.remove('d-none');
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
    }

    async saveReservation(e) {
        e.preventDefault();
        
        const reservation = {
            customer: document.getElementById('customer').value,
            date: document.getElementById('reservationDate').value,
            flightHotel: document.getElementById('flightHotel').value,
            eta: document.getElementById('eta').value,
            direction: document.getElementById('direction').value,
            guestName: document.getElementById('guestName').value,
            nationality: document.getElementById('nationality').value,
            status: 'reserved',
            createdAt: new Date().toISOString(),
            createdBy: this.currentUser.username
        };
        
        try {
            await this.db.collection('reservations').add(reservation);
            alert('Reservation saved successfully!');
            document.getElementById('reservationForm').reset();
            document.getElementById('reservationDate').value = new Date().toISOString().split('T')[0];
        } catch (error) {
            console.error('Error saving reservation:', error);
            alert('Error saving reservation. Please try again.');
        }
    }

    async loadCheckinData() {
        const date = document.getElementById('checkinDateFilter').value;
        const flightFilter = document.getElementById('checkinFlightFilter').value;
        
        try {
            let query = this.db.collection('reservations')
                .where('date', '==', date)
                .where('status', '==', 'reserved');
            
            const snapshot = await query.get();
            const tableBody = document.getElementById('checkinTable');
            tableBody.innerHTML = '';
            
            snapshot.forEach(doc => {
                const data = doc.data();
                if (flightFilter && data.flightHotel !== flightFilter) return;
                
                const row = `
                    <tr>
                        <td>${data.guestName}</td>
                        <td>${data.flightHotel}</td>
                        <td>${data.eta}</td>
                        <td>${data.direction}</td>
                        <td>${data.nationality}</td>
                        <td>
                            <button class="btn btn-sm btn-success" onclick="app.checkinGuest('${doc.id}')">
                                <i class="fas fa-sign-in-alt"></i> Check-In
                            </button>
                        </td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
        } catch (error) {
            console.error('Error loading check-in data:', error);
        }
    }

    async checkinGuest(reservationId) {
        const checkinTime = new Date().toLocaleTimeString();
        
        try {
            await this.db.collection('reservations').doc(reservationId).update({
                status: 'checked-in',
                checkinTime: checkinTime,
                checkinBy: this.currentUser.username,
                checkinDate: new Date().toISOString()
            });
            
            alert('Guest checked in successfully!');
            this.loadCheckinData();
            this.loadCheckoutData(); // Refresh checkout tab if open
        } catch (error) {
            console.error('Error checking in guest:', error);
            alert('Error checking in guest. Please try again.');
        }
    }

    async loadCheckoutData() {
        const date = document.getElementById('checkoutDateFilter').value;
        const flightFilter = document.getElementById('checkoutFlightFilter').value;
        
        try {
            let query = this.db.collection('reservations')
                .where('status', '==', 'checked-in');
            
            // Filter by date if provided
            if (date) {
                const startDate = new Date(date + 'T00:00:00');
                const endDate = new Date(date + 'T23:59:59');
                query = query.where('checkinDate', '>=', startDate.toISOString())
                             .where('checkinDate', '<=', endDate.toISOString());
            }
            
            const snapshot = await query.get();
            const tableBody = document.getElementById('checkoutTable');
            tableBody.innerHTML = '';
            
            snapshot.forEach(doc => {
                const data = doc.data();
                if (flightFilter && data.flightHotel !== flightFilter) return;
                
                const row = `
                    <tr>
                        <td>${data.guestName}</td>
                        <td>${data.flightHotel}</td>
                        <td>${data.eta}</td>
                        <td>${data.direction}</td>
                        <td>${data.checkinTime || 'N/A'}</td>
                        <td>
                            <button class="btn btn-sm btn-warning" onclick="app.checkoutGuest('${doc.id}')">
                                <i class="fas fa-sign-out-alt"></i> Check-Out
                            </button>
                        </td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
        } catch (error) {
            console.error('Error loading check-out data:', error);
        }
    }

    async checkoutGuest(reservationId) {
        const checkoutTime = new Date().toLocaleTimeString();
        
        try {
            await this.db.collection('reservations').doc(reservationId).update({
                status: 'checked-out',
                checkoutTime: checkoutTime,
                checkoutBy: this.currentUser.username,
                checkoutDate: new Date().toISOString()
            });
            
            alert('Guest checked out successfully!');
            this.loadCheckoutData();
        } catch (error) {
            console.error('Error checking out guest:', error);
            alert('Error checking out guest. Please try again.');
        }
    }

    async loadFlightOptions(selectId) {
        try {
            const snapshot = await this.db.collection('reservations')
                .orderBy('flightHotel')
                .get();
            
            const flights = [...new Set(snapshot.docs.map(doc => doc.data().flightHotel))];
            const select = document.getElementById(selectId);
            
            // Keep existing "All" option
            const currentValue = select.value;
            select.innerHTML = '<option value="">All</option>';
            
            flights.forEach(flight => {
                const option = document.createElement('option');
                option.value = flight;
                option.textContent = flight;
                select.appendChild(option);
            });
            
            // Restore previous selection if possible
            select.value = currentValue;
        } catch (error) {
            console.error('Error loading flight options:', error);
        }
    }

    async generateReport() {
        const fromDate = document.getElementById('reportFromDate').value;
        const toDate = document.getElementById('reportToDate').value;
        const flightFilter = document.getElementById('reportFlightFilter').value;
        
        try {
            let query = this.db.collection('reservations')
                .where('status', '==', 'checked-out');
            
            // Apply date filter
            if (fromDate && toDate) {
                const startDate = new Date(fromDate + 'T00:00:00');
                const endDate = new Date(toDate + 'T23:59:59');
                query = query.where('checkoutDate', '>=', startDate.toISOString())
                             .where('checkoutDate', '<=', endDate.toISOString());
            }
            
            const snapshot = await query.get();
            const reservations = [];
            
            snapshot.forEach(doc => {
                const data = doc.data();
                if (flightFilter && data.flightHotel !== flightFilter) return;
                reservations.push({ id: doc.id, ...data });
            });
            
            this.displayReport(reservations);
        } catch (error) {
            console.error('Error generating report:', error);
            alert('Error generating report. Please try again.');
        }
    }

    displayReport(reservations) {
        const reportDiv = document.getElementById('reportDisplay');
        const currentDate = new Date().toLocaleDateString();
        
        let reportHTML = `
            <div class="report-container">
                <!-- Header -->
                <div class="row mb-4">
                    <div class="col-2">
                        <div class="logo-placeholder" style="width: 100px; height: 100px; border: 1px solid #ccc; text-align: center; line-height: 100px;">
                            LOGO
                        </div>
                    </div>
                    <div class="col-8">
                        <h4>Hotel Management System</h4>
                        <p>123 Hotel Street, City, Country</p>
                        <p>Phone: +123 456 7890 | Email: info@hotel.com</p>
                    </div>
                    <div class="col-2 text-end">
                        <p>Date: ${currentDate}</p>
                    </div>
                </div>
                
                <!-- Customer Info -->
                <div class="mb-3">
                    <h5>Guest Check-Out Report</h5>
                </div>
                
                <!-- Table -->
                <div class="table-responsive">
                    <table class="table table-bordered">
                        <thead class="table-dark">
                            <tr>
                                <th>Name</th>
                                <th>Flight/Hotel</th>
                                <th>ETA</th>
                                <th>Direction</th>
                                <th>Check-In Time</th>
                                <th>Check-Out Time</th>
                                <th>Remarks</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        reservations.forEach(reservation => {
            reportHTML += `
                <tr>
                    <td>${reservation.guestName}</td>
                    <td>${reservation.flightHotel}</td>
                    <td>${reservation.eta}</td>
                    <td>${reservation.direction}</td>
                    <td>${reservation.checkinTime || 'N/A'}</td>
                    <td>${reservation.checkoutTime || 'N/A'}</td>
                    <td></td>
                </tr>
            `;
        });
        
        reportHTML += `
                        </tbody>
                    </table>
                </div>
                
                <!-- Footer -->
                <div class="row mt-5">
                    <div class="col-6">
                        <div class="signature-section">
                            <p><strong>Prepared by:</strong></p>
                            <p>Name: ${this.currentUser.name}</p>
                            <p>RC No: ${this.currentUser.RCNo}</p>
                            <p class="signature-line">_____________________</p>
                            <p>Signature</p>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="signature-section">
                            <p><strong>Checked by:</strong></p>
                            <p>Name: _____________________</p>
                            <p>RC No: _____________________</p>
                            <p class="signature-line">_____________________</p>
                            <p>Signature</p>
                        </div>
                    </div>
                </div>
                
                <!-- Print Button -->
                <div class="text-center no-print mt-4">
                    <button class="btn btn-primary me-2" onclick="window.print()">
                        <i class="fas fa-print"></i> Print Report
                    </button>
                    <button class="btn btn-secondary" onclick="document.getElementById('reportDisplay').classList.add('d-none')">
                        <i class="fas fa-times"></i> Close
                    </button>
                </div>
            </div>
        `;
        
        reportDiv.innerHTML = reportHTML;
        reportDiv.classList.remove('d-none');
    }
}

// Initialize application
const app = new ReservationSystem();
