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
        
        // Filters - Add change listeners
        document.getElementById('checkinDateFilter').addEventListener('change', () => this.loadCheckinData());
        document.getElementById('checkinFlightFilter').addEventListener('change', () => this.loadCheckinData());
        
        document.getElementById('checkoutDateFilter').addEventListener('change', () => this.loadCheckoutData());
        document.getElementById('checkoutFlightFilter').addEventListener('change', () => this.loadCheckoutData());
        
        document.getElementById('reportFromDate').addEventListener('change', () => this.loadReportOptions());
        document.getElementById('reportToDate').addEventListener('change', () => this.loadReportOptions());
        document.getElementById('reportFlightFilter').addEventListener('change', () => this.loadReportOptions());
        
        document.getElementById('generateReportBtn').addEventListener('click', () => this.generateReport());
        
        // Tab change events
        document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
            tab.addEventListener('shown.bs.tab', (e) => {
                const target = e.target.getAttribute('href');
                if (target === '#checkinTab') {
                    this.loadCheckinData();
                    this.loadFlightOptionsForCheckin();
                } else if (target === '#checkoutTab') {
                    this.loadCheckoutData();
                    this.loadFlightOptionsForCheckout();
                } else if (target === '#reportTab') {
                    this.loadReportOptions();
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
        
        // Hash the password
        const hashedPassword = this.hashPassword(password);
        
        // Find user in users array
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
        // Simple hash function for demo purposes
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
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
        
        // Load initial data
        this.loadFlightOptionsForCheckin();
        this.loadFlightOptionsForCheckout();
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
            createdBy: this.currentUser.username,
            checkinDate: null,
            checkoutDate: null
        };
        
        try {
            await this.db.collection('reservations').add(reservation);
            alert('Reservation saved successfully!');
            document.getElementById('reservationForm').reset();
            document.getElementById('reservationDate').value = new Date().toISOString().split('T')[0];
            
            // Refresh flight options in all filters
            this.loadFlightOptionsForCheckin();
            this.loadFlightOptionsForCheckout();
            this.loadReportOptions();
        } catch (error) {
            console.error('Error saving reservation:', error);
            alert('Error saving reservation. Please try again.');
        }
    }

    async loadFlightOptionsForCheckin() {
        try {
            const snapshot = await this.db.collection('reservations')
                .where('status', '==', 'reserved')
                .get();
            
            const flights = [...new Set(snapshot.docs.map(doc => doc.data().flightHotel))];
            const select = document.getElementById('checkinFlightFilter');
            const currentValue = select.value;
            
            select.innerHTML = '<option value="">All</option>';
            flights.forEach(flight => {
                if (flight) {
                    const option = document.createElement('option');
                    option.value = flight;
                    option.textContent = flight;
                    select.appendChild(option);
                }
            });
            
            // Restore previous selection if possible
            if (flights.includes(currentValue)) {
                select.value = currentValue;
            }
        } catch (error) {
            console.error('Error loading flight options for check-in:', error);
        }
    }

    async loadFlightOptionsForCheckout() {
        try {
            const snapshot = await this.db.collection('reservations')
                .where('status', '==', 'checked-in')
                .get();
            
            const flights = [...new Set(snapshot.docs.map(doc => doc.data().flightHotel))];
            const select = document.getElementById('checkoutFlightFilter');
            const currentValue = select.value;
            
            select.innerHTML = '<option value="">All</option>';
            flights.forEach(flight => {
                if (flight) {
                    const option = document.createElement('option');
                    option.value = flight;
                    option.textContent = flight;
                    select.appendChild(option);
                }
            });
            
            // Restore previous selection if possible
            if (flights.includes(currentValue)) {
                select.value = currentValue;
            }
        } catch (error) {
            console.error('Error loading flight options for check-out:', error);
        }
    }

    async loadCheckinData() {
        const date = document.getElementById('checkinDateFilter').value;
        const flightFilter = document.getElementById('checkinFlightFilter').value;
        
        try {
            // First, get the start and end of the selected date
            const startDate = new Date(date + 'T00:00:00');
            const endDate = new Date(date + 'T23:59:59');
            
            let query = this.db.collection('reservations')
                .where('date', '==', date)
                .where('status', '==', 'reserved');
            
            const snapshot = await query.get();
            const tableBody = document.getElementById('checkinTable');
            tableBody.innerHTML = '';
            
            if (snapshot.empty) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center text-muted">
                            No guests available for check-in on ${date}
                        </td>
                    </tr>
                `;
                return;
            }
            
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
            const tableBody = document.getElementById('checkinTable');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-danger">
                        Error loading data. Please try again.
                    </td>
                </tr>
            `;
        }
    }

    async checkinGuest(reservationId) {
        if (!confirm('Are you sure you want to check in this guest?')) {
            return;
        }
        
        const now = new Date();
        const checkinTime = now.toLocaleTimeString('en-US', { 
            hour12: true, 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        try {
            await this.db.collection('reservations').doc(reservationId).update({
                status: 'checked-in',
                checkinTime: checkinTime,
                checkinDateTime: now.toISOString(),
                checkinBy: this.currentUser.username,
                checkinDate: new Date().toISOString().split('T')[0]
            });
            
            alert('Guest checked in successfully!');
            
            // Refresh both check-in and check-out data
            this.loadCheckinData();
            this.loadFlightOptionsForCheckout(); // Update flight options for checkout
            this.loadCheckoutData();
            
        } catch (error) {
            console.error('Error checking in guest:', error);
            alert('Error checking in guest. Please try again.');
        }
    }

    async loadCheckoutData() {
        const date = document.getElementById('checkoutDateFilter').value;
        const flightFilter = document.getElementById('checkoutFlightFilter').value;
        
        try {
            // Create date range for filtering
            const startDate = new Date(date + 'T00:00:00');
            const endDate = new Date(date + 'T23:59:59');
            
            let query = this.db.collection('reservations')
                .where('status', '==', 'checked-in');
            
            const snapshot = await query.get();
            const tableBody = document.getElementById('checkoutTable');
            tableBody.innerHTML = '';
            
            if (snapshot.empty) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center text-muted">
                            No checked-in guests available for checkout
                        </td>
                    </tr>
                `;
                return;
            }
            
            let hasData = false;
            
            snapshot.forEach(doc => {
                const data = doc.data();
                
                // Filter by check-in date
                if (date && data.checkinDate !== date) return;
                
                // Filter by flight/hotel
                if (flightFilter && data.flightHotel !== flightFilter) return;
                
                hasData = true;
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
            
            if (!hasData) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center text-muted">
                            No guests available for checkout on ${date}
                        </td>
                    </tr>
                `;
            }
        } catch (error) {
            console.error('Error loading check-out data:', error);
            const tableBody = document.getElementById('checkoutTable');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-danger">
                        Error loading data. Please try again.
                    </td>
                </tr>
            `;
        }
    }

    async checkoutGuest(reservationId) {
        if (!confirm('Are you sure you want to check out this guest?')) {
            return;
        }
        
        const now = new Date();
        const checkoutTime = now.toLocaleTimeString('en-US', { 
            hour12: true, 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        try {
            await this.db.collection('reservations').doc(reservationId).update({
                status: 'checked-out',
                checkoutTime: checkoutTime,
                checkoutDateTime: now.toISOString(),
                checkoutBy: this.currentUser.username,
                checkoutDate: new Date().toISOString().split('T')[0]
            });
            
            alert('Guest checked out successfully!');
            
            // Refresh data
            this.loadCheckoutData();
            this.loadFlightOptionsForCheckout(); // Update flight options
            
        } catch (error) {
            console.error('Error checking out guest:', error);
            alert('Error checking out guest. Please try again.');
        }
    }

    async loadReportOptions() {
        try {
            // Load flight options for report filter
            const snapshot = await this.db.collection('reservations')
                .where('status', '==', 'checked-out')
                .get();
            
            const flights = [...new Set(snapshot.docs.map(doc => doc.data().flightHotel))];
            const select = document.getElementById('reportFlightFilter');
            const currentValue = select.value;
            
            select.innerHTML = '<option value="">All</option>';
            flights.forEach(flight => {
                if (flight) {
                    const option = document.createElement('option');
                    option.value = flight;
                    option.textContent = flight;
                    select.appendChild(option);
                }
            });
            
            // Restore previous selection if possible
            if (flights.includes(currentValue)) {
                select.value = currentValue;
            }
        } catch (error) {
            console.error('Error loading report options:', error);
        }
    }

    async generateReport() {
        const fromDate = document.getElementById('reportFromDate').value;
        const toDate = document.getElementById('reportToDate').value;
        const flightFilter = document.getElementById('reportFlightFilter').value;
        
        // Validate dates
        if (fromDate && toDate && fromDate > toDate) {
            alert('From date cannot be after To date');
            return;
        }
        
        try {
            let query = this.db.collection('reservations')
                .where('status', '==', 'checked-out');
            
            // Apply date range filter
            if (fromDate && toDate) {
                const startDate = new Date(fromDate + 'T00:00:00');
                const endDate = new Date(toDate + 'T23:59:59');
                
                query = query.where('checkoutDateTime', '>=', startDate.toISOString())
                             .where('checkoutDateTime', '<=', endDate.toISOString());
            }
            
            const snapshot = await query.get();
            const reservations = [];
            
            snapshot.forEach(doc => {
                const data = doc.data();
                // Apply flight filter
                if (flightFilter && data.flightHotel !== flightFilter) return;
                reservations.push({ id: doc.id, ...data });
            });
            
            if (reservations.length === 0) {
                alert('No checked-out guests found for the selected criteria.');
                return;
            }
            
            this.displayReport(reservations, fromDate, toDate);
        } catch (error) {
            console.error('Error generating report:', error);
            alert('Error generating report. Please try again.');
        }
    }

    displayReport(reservations, fromDate, toDate) {
        const reportDiv = document.getElementById('reportDisplay');
        const currentDate = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        // Date range text
        let dateRangeText = '';
        if (fromDate && toDate) {
            const from = new Date(fromDate).toLocaleDateString();
            const to = new Date(toDate).toLocaleDateString();
            dateRangeText = `From ${from} to ${to}`;
        } else if (fromDate) {
            const from = new Date(fromDate).toLocaleDateString();
            dateRangeText = `From ${from}`;
        } else if (toDate) {
            const to = new Date(toDate).toLocaleDateString();
            dateRangeText = `Up to ${to}`;
        }
        
        let reportHTML = `
            <div class="report-container" style="font-family: Arial, sans-serif;">
                <!-- Header -->
                <div class="row mb-4">
                    <div class="col-2">
                        <div style="width: 100px; height: 100px; border: 1px solid #ccc; text-align: center; line-height: 100px; font-size: 12px;">
                            COMPANY LOGO
                        </div>
                    </div>
                    <div class="col-8 text-center">
                        <h4 style="margin-bottom: 5px;">Hotel Management System</h4>
                        <p style="margin-bottom: 2px; font-size: 14px;">123 Hotel Street, City, Country</p>
                        <p style="margin-bottom: 2px; font-size: 14px;">Phone: +123 456 7890 | Email: info@hotel.com</p>
                        <hr style="margin: 10px 0;">
                        <h5 style="margin-bottom: 5px;">Guest Check-Out Report</h5>
                        <p style="font-size: 14px; margin-bottom: 5px;">${dateRangeText}</p>
                        <p style="font-size: 14px;">Generated on: ${currentDate}</p>
                    </div>
                    <div class="col-2"></div>
                </div>
                
                <!-- Table -->
                <div class="table-responsive">
                    <table class="table table-bordered" style="width: 100%; border-collapse: collapse;">
                        <thead style="background-color: #343a40; color: white;">
                            <tr>
                                <th style="padding: 8px; border: 1px solid #dee2e6;">Name</th>
                                <th style="padding: 8px; border: 1px solid #dee2e6;">Flight/Hotel</th>
                                <th style="padding: 8px; border: 1px solid #dee2e6;">ETA</th>
                                <th style="padding: 8px; border: 1px solid #dee2e6;">Direction</th>
                                <th style="padding: 8px; border: 1px solid #dee2e6;">Check-In Time</th>
                                <th style="padding: 8px; border: 1px solid #dee2e6;">Check-Out Time</th>
                                <th style="padding: 8px; border: 1px solid #dee2e6;">Remarks</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        reservations.forEach(reservation => {
            reportHTML += `
                <tr>
                    <td style="padding: 8px; border: 1px solid #dee2e6;">${reservation.guestName}</td>
                    <td style="padding: 8px; border: 1px solid #dee2e6;">${reservation.flightHotel}</td>
                    <td style="padding: 8px; border: 1px solid #dee2e6;">${reservation.eta}</td>
                    <td style="padding: 8px; border: 1px solid #dee2e6;">${reservation.direction}</td>
                    <td style="padding: 8px; border: 1px solid #dee2e6;">${reservation.checkinTime || 'N/A'}</td>
                    <td style="padding: 8px; border: 1px solid #dee2e6;">${reservation.checkoutTime || 'N/A'}</td>
                    <td style="padding: 8px; border: 1px solid #dee2e6;"></td>
                </tr>
            `;
        });
        
        reportHTML += `
                        </tbody>
                    </table>
                </div>
                
                <!-- Footer -->
                <div class="row mt-5" style="margin-top: 50px;">
                    <div class="col-6">
                        <div style="margin-top: 30px;">
                            <p style="margin-bottom: 5px;"><strong>Prepared by:</strong></p>
                            <p style="margin-bottom: 2px;">Name: ${this.currentUser.name}</p>
                            <p style="margin-bottom: 2px;">RC No: ${this.currentUser.RCNo}</p>
                            <p style="border-top: 1px solid #000; width: 200px; margin-top: 40px; padding-top: 5px;">Signature</p>
                        </div>
                    </div>
                    <div class="col-6">
                        <div style="margin-top: 30px;">
                            <p style="margin-bottom: 5px;"><strong>Checked by:</strong></p>
                            <p style="margin-bottom: 2px;">Name: _____________________</p>
                            <p style="margin-bottom: 2px;">RC No: _____________________</p>
                            <p style="border-top: 1px solid #000; width: 200px; margin-top: 40px; padding-top: 5px;">Signature</p>
                        </div>
                    </div>
                </div>
                
                <!-- Print Button -->
                <div class="text-center no-print mt-4">
                    <button class="btn btn-primary me-2" onclick="window.print()">
                        <i class="fas fa-print"></i> Print Report
                    </button>
                    <button class="btn btn-secondary" onclick="document.getElementById('reportDisplay').classList.add('d-none')">
                        <i class="fas fa-times"></i> Close Report
                    </button>
                </div>
            </div>
        `;
        
        reportDiv.innerHTML = reportHTML;
        reportDiv.classList.remove('d-none');
        
        // Scroll to report
        reportDiv.scrollIntoView({ behavior: 'smooth' });
    }
}

// Initialize application
const app = new ReservationSystem();
