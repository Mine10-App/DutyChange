class ReservationSystem {
    constructor() {
        this.currentUser = null;
        this.db = firebase.firestore();
        this.customers = new Set();
        this.flightHotels = new Set();
        this.recentReservations = []; // Store recent reservations
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuth();
        this.loadAutocompleteData();
        this.loadRecentReservations(); // Load recent reservations on init
    }

    async loadAutocompleteData() {
        try {
            const snapshot = await this.db.collection('reservations').get();
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.customer) this.customers.add(data.customer);
                if (data.flightHotel) this.flightHotels.add(data.flightHotel);
            });
        } catch (error) {
            console.error('Error loading autocomplete data:', error);
        }
    }

    setupEventListeners() {
        // Login
        document.getElementById('loginBtn').addEventListener('click', () => this.login());
        
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        
        // Forms
        document.getElementById('reservationForm').addEventListener('submit', (e) => this.saveReservation(e));
        
        // Autocomplete setup
        const customerInput = document.getElementById('customer');
        if (customerInput) {
            customerInput.addEventListener('focus', () => this.showCustomerDropdown());
            customerInput.addEventListener('input', (e) => this.filterCustomerDropdown(e.target.value));
        }
        
        const flightInput = document.getElementById('flightHotel');
        if (flightInput) {
            flightInput.addEventListener('focus', () => this.showFlightDropdown());
            flightInput.addEventListener('input', (e) => this.filterFlightDropdown(e.target.value));
        }
        
        // Click outside to close dropdowns
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.autocomplete-container')) {
                this.closeAllDropdowns();
            }
        });
        
        // Filters
        const checkinDateFilter = document.getElementById('checkinDateFilter');
        if (checkinDateFilter) {
            checkinDateFilter.addEventListener('change', () => this.loadCheckinData());
        }
        
        const checkinFlightFilter = document.getElementById('checkinFlightFilter');
        if (checkinFlightFilter) {
            checkinFlightFilter.addEventListener('change', () => this.loadCheckinData());
        }
        
        const checkoutDateFilter = document.getElementById('checkoutDateFilter');
        if (checkoutDateFilter) {
            checkoutDateFilter.addEventListener('change', () => this.loadCheckoutData());
        }
        
        const checkoutFlightFilter = document.getElementById('checkoutFlightFilter');
        if (checkoutFlightFilter) {
            checkoutFlightFilter.addEventListener('change', () => this.loadCheckoutData());
        }
        
        const generateReportBtn = document.getElementById('generateReportBtn');
        if (generateReportBtn) {
            generateReportBtn.addEventListener('click', () => this.generateReport());
        }
        
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
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.showDashboard();
        }
    }

    login() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        // Hash the password using SHA-256
        this.hashPasswordSHA256(password).then(hashedPassword => {
            const user = users.find(u => u.username === username && u.passwordHash === hashedPassword);
            
            if (user) {
                this.currentUser = user;
                localStorage.setItem('currentUser', JSON.stringify(user));
                this.showDashboard();
                this.hideError();
            } else {
                this.showError('Invalid username or password');
            }
        }).catch(error => {
            console.error('Error hashing password:', error);
            this.showError('Login error. Please try again.');
        });
    }

    async hashPasswordSHA256(password) {
        // Convert password to Uint8Array
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        
        // Hash with SHA-256
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        
        // Convert to hex string
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return hashHex;
    }

    showError(message) {
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.remove('d-none');
        }
    }

    hideError() {
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) {
            errorDiv.classList.add('d-none');
        }
    }

    showDashboard() {
        const loginScreen = document.getElementById('loginScreen');
        const dashboard = document.getElementById('dashboard');
        
        if (loginScreen) loginScreen.classList.add('d-none');
        if (dashboard) dashboard.classList.remove('d-none');
        
        // Display user info
        const userName = document.getElementById('userName');
        const userLevel = document.getElementById('userLevel');
        const userRC = document.getElementById('userRC');
        
        if (userName) userName.textContent = this.currentUser.name;
        if (userLevel) userLevel.textContent = this.currentUser.Level;
        if (userRC) userRC.textContent = this.currentUser.RCNo;
        
        // Set default dates
        const today = new Date().toISOString().split('T')[0];
        const dateFields = [
            'reservationDate',
            'checkinDateFilter',
            'checkoutDateFilter',
            'reportFromDate',
            'reportToDate'
        ];
        
        dateFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) field.value = today;
        });
        
        // Load initial data
        this.loadCheckinData();
        this.loadCheckoutData();
        this.loadFlightOptionsForCheckin();
        this.loadFlightOptionsForCheckout();
        this.loadReportOptions();
        this.loadRecentReservations(); // Load recent reservations
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        
        const dashboard = document.getElementById('dashboard');
        const loginScreen = document.getElementById('loginScreen');
        
        if (dashboard) dashboard.classList.add('d-none');
        if (loginScreen) loginScreen.classList.remove('d-none');
        
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        
        if (usernameInput) usernameInput.value = '';
        if (passwordInput) passwordInput.value = '';
        
        // Clear recent reservations
        this.recentReservations = [];
    }

    showCustomerDropdown() {
        this.closeAllDropdowns();
        const input = document.getElementById('customer');
        if (!input) return;
        
        const container = input.parentElement;
        const dropdown = document.createElement('div');
        dropdown.className = 'autocomplete-dropdown';
        dropdown.style.cssText = `
            position: absolute;
            background: white;
            border: 1px solid #ced4da;
            border-radius: 4px;
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
            width: ${input.offsetWidth}px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        `;
        
        // Add "Add new" option
        const addNewOption = document.createElement('div');
        addNewOption.className = 'dropdown-item';
        addNewOption.style.cssText = 'padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f0f0f0;';
        addNewOption.innerHTML = '<i class="fas fa-plus"></i> Add new customer';
        addNewOption.onclick = () => {
            this.closeAllDropdowns();
            input.focus();
        };
        dropdown.appendChild(addNewOption);
        
        // Add existing customers
        Array.from(this.customers).sort().forEach(customer => {
            const option = document.createElement('div');
            option.className = 'dropdown-item';
            option.style.cssText = 'padding: 8px 12px; cursor: pointer;';
            option.textContent = customer;
            option.onclick = () => {
                input.value = customer;
                this.closeAllDropdowns();
            };
            dropdown.appendChild(option);
        });
        
        container.style.position = 'relative';
        container.appendChild(dropdown);
    }

    showFlightDropdown() {
        this.closeAllDropdowns();
        const input = document.getElementById('flightHotel');
        if (!input) return;
        
        const container = input.parentElement;
        const dropdown = document.createElement('div');
        dropdown.className = 'autocomplete-dropdown';
        dropdown.style.cssText = `
            position: absolute;
            background: white;
            border: 1px solid #ced4da;
            border-radius: 4px;
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
            width: ${input.offsetWidth}px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        `;
        
        // Add "Add new" option
        const addNewOption = document.createElement('div');
        addNewOption.className = 'dropdown-item';
        addNewOption.style.cssText = 'padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f0f0f0;';
        addNewOption.innerHTML = '<i class="fas fa-plus"></i> Add new flight/hotel';
        addNewOption.onclick = () => {
            this.closeAllDropdowns();
            input.focus();
        };
        dropdown.appendChild(addNewOption);
        
        // Add existing flights/hotels
        Array.from(this.flightHotels).sort().forEach(flightHotel => {
            const option = document.createElement('div');
            option.className = 'dropdown-item';
            option.style.cssText = 'padding: 8px 12px; cursor: pointer;';
            option.textContent = flightHotel;
            option.onclick = () => {
                input.value = flightHotel;
                this.closeAllDropdowns();
            };
            dropdown.appendChild(option);
        });
        
        container.style.position = 'relative';
        container.appendChild(dropdown);
    }

    filterCustomerDropdown(searchTerm) {
        // Implement filtering if needed
    }

    filterFlightDropdown(searchTerm) {
        // Implement filtering if needed
    }

    closeAllDropdowns() {
        document.querySelectorAll('.autocomplete-dropdown').forEach(dropdown => {
            dropdown.remove();
        });
    }

    async saveReservation(e) {
        e.preventDefault();
        
        const customer = document.getElementById('customer').value;
        const flightHotel = document.getElementById('flightHotel').value;
        const reservationDate = document.getElementById('reservationDate').value;
        
        const reservation = {
            customer: customer,
            date: reservationDate,
            flightHotel: flightHotel,
            eta: document.getElementById('eta').value,
            direction: document.getElementById('direction').value,
            guestName: document.getElementById('guestName').value,
            nationality: document.getElementById('nationality').value,
            status: 'reserved',
            createdAt: new Date().toISOString(),
            createdBy: this.currentUser.username,
            checkinDate: null,
            checkoutDate: null,
            reservationDate: reservationDate
        };
        
        try {
            const docRef = await this.db.collection('reservations').add(reservation);
            
            // Add to autocomplete sets
            if (customer) this.customers.add(customer);
            if (flightHotel) this.flightHotels.add(flightHotel);
            
            alert('Reservation saved successfully!');
            
            // Add to recent reservations list
            const newReservation = {
                id: docRef.id,
                ...reservation
            };
            this.recentReservations.unshift(newReservation); // Add to beginning
            if (this.recentReservations.length > 10) {
                this.recentReservations = this.recentReservations.slice(0, 10); // Keep only last 10
            }
            
            // Display recent reservations
            this.displayRecentReservations();
            
            document.getElementById('reservationForm').reset();
            document.getElementById('reservationDate').value = new Date().toISOString().split('T')[0];
            
            // Refresh all data
            this.loadCheckinData();
            this.loadCheckoutData();
            this.loadFlightOptionsForCheckin();
            this.loadFlightOptionsForCheckout();
            this.loadReportOptions();
            
        } catch (error) {
            console.error('Error saving reservation:', error);
            alert('Error saving reservation. Please try again.');
        }
    }

    async loadRecentReservations() {
        try {
            const snapshot = await this.db.collection('reservations')
                .where('status', '==', 'reserved')
                .orderBy('createdAt', 'desc')
                .limit(10)
                .get();
            
            this.recentReservations = [];
            snapshot.forEach(doc => {
                this.recentReservations.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            this.displayRecentReservations();
        } catch (error) {
            console.error('Error loading recent reservations:', error);
        }
    }

    displayRecentReservations() {
        const container = document.getElementById('recentReservationsContainer');
        if (!container) return;
        
        if (this.recentReservations.length === 0) {
            container.innerHTML = `
                <div class="card">
                    <div class="card-body">
                        <h6 class="card-title mb-3">Recent Reservations</h6>
                        <p class="text-muted mb-0">No recent reservations found.</p>
                    </div>
                </div>
            `;
            return;
        }
        
        let html = `
            <div class="card">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h6 class="card-title mb-0">Recent Reservations</h6>
                        <span class="badge bg-primary">${this.recentReservations.length}</span>
                    </div>
                    <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                        <table class="table table-sm table-hover mb-0">
                            <thead>
                                <tr>
                                    <th>Guest</th>
                                    <th>Flight/Hotel</th>
                                    <th>Customer</th>
                                    <th>Status</th>
                                    <th>Time</th>
                                </tr>
                            </thead>
                            <tbody>
        `;
        
        this.recentReservations.forEach(res => {
            const time = new Date(res.createdAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            });
            
            html += `
                <tr onclick="app.showReservationDetails('${res.id}')" style="cursor: pointer;">
                    <td>${res.guestName}</td>
                    <td>${res.flightHotel}</td>
                    <td>${res.customer}</td>
                    <td>
                        <span class="badge bg-warning text-dark">Reserved</span>
                    </td>
                    <td>${time}</td>
                </tr>
            `;
        });
        
        html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    }

    async showReservationDetails(reservationId) {
        try {
            const doc = await this.db.collection('reservations').doc(reservationId).get();
            if (!doc.exists) {
                alert('Reservation not found!');
                return;
            }
            
            const reservation = doc.data();
            
            // Create modal for details
            const modalHtml = `
                <div class="modal fade" id="reservationDetailsModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Reservation Details</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label class="form-label"><strong>Guest Name:</strong></label>
                                            <p>${reservation.guestName}</p>
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label"><strong>Customer:</strong></label>
                                            <p>${reservation.customer}</p>
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label"><strong>Flight/Hotel:</strong></label>
                                            <p>${reservation.flightHotel}</p>
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label"><strong>ETA:</strong></label>
                                            <p>${reservation.eta}</p>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label class="form-label"><strong>Direction:</strong></label>
                                            <p>${reservation.direction}</p>
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label"><strong>Nationality:</strong></label>
                                            <p>${reservation.nationality}</p>
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label"><strong>Reservation Date:</strong></label>
                                            <p>${reservation.reservationDate}</p>
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label"><strong>Status:</strong></label>
                                            <span class="badge bg-warning text-dark">${reservation.status}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="mt-3">
                                    <label class="form-label"><strong>Created:</strong></label>
                                    <p>${new Date(reservation.createdAt).toLocaleString()}</p>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                                <button type="button" class="btn btn-danger" onclick="app.deleteReservation('${reservationId}')">Delete</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Remove existing modal if any
            const existingModal = document.getElementById('reservationDetailsModal');
            if (existingModal) {
                existingModal.remove();
            }
            
            // Add modal to body
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('reservationDetailsModal'));
            modal.show();
            
        } catch (error) {
            console.error('Error loading reservation details:', error);
            alert('Error loading reservation details.');
        }
    }

    async deleteReservation(reservationId) {
        if (!confirm('Are you sure you want to delete this reservation? This action cannot be undone.')) {
            return;
        }
        
        try {
            await this.db.collection('reservations').doc(reservationId).delete();
            
            // Remove from recent reservations
            this.recentReservations = this.recentReservations.filter(res => res.id !== reservationId);
            
            // Refresh display
            this.displayRecentReservations();
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('reservationDetailsModal'));
            if (modal) {
                modal.hide();
            }
            
            alert('Reservation deleted successfully!');
            
            // Refresh other data
            this.loadCheckinData();
            this.loadCheckoutData();
            
        } catch (error) {
            console.error('Error deleting reservation:', error);
            alert('Error deleting reservation. Please try again.');
        }
    }

    async loadFlightOptionsForCheckin() {
        try {
            const date = document.getElementById('checkinDateFilter').value;
            const snapshot = await this.db.collection('reservations')
                .where('reservationDate', '==', date)
                .where('status', '==', 'reserved')
                .get();
            
            const flights = [...new Set(snapshot.docs.map(doc => doc.data().flightHotel))];
            const select = document.getElementById('checkinFlightFilter');
            if (!select) return;
            
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
            if (!select) return;
            
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
            
            if (flights.includes(currentValue)) {
                select.value = currentValue;
            }
        } catch (error) {
            console.error('Error loading flight options for check-out:', error);
        }
    }

    async loadCheckinData() {
        const dateInput = document.getElementById('checkinDateFilter');
        const flightSelect = document.getElementById('checkinFlightFilter');
        const tableBody = document.getElementById('checkinTable');
        
        if (!dateInput || !tableBody) return;
        
        const date = dateInput.value;
        const flightFilter = flightSelect ? flightSelect.value : '';
        
        try {
            let query = this.db.collection('reservations')
                .where('reservationDate', '==', date)
                .where('status', '==', 'reserved');
            
            const snapshot = await query.get();
            tableBody.innerHTML = '';
            
            if (snapshot.empty) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center text-muted">
                            No reservations found for ${date}
                        </td>
                    </tr>
                `;
                return;
            }
            
            let hasData = false;
            
            snapshot.forEach(doc => {
                const data = doc.data();
                if (flightFilter && data.flightHotel !== flightFilter) return;
                
                hasData = true;
                const row = `
                    <tr>
                        <td>${data.guestName}</td>
                        <td>${data.flightHotel}</td>
                        <td>${data.eta}</td>
                        <td>${data.direction}</td>
                        <td>${data.nationality}</td>
                        <td><span class="status-badge status-reserved">Reserved</span></td>
                        <td>
                            <button class="btn btn-sm btn-success" onclick="app.checkinGuest('${doc.id}')">
                                <i class="fas fa-sign-in-alt"></i> Check-In
                            </button>
                        </td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
            
            if (!hasData) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center text-muted">
                            No guests match the selected filter for ${date}
                        </td>
                    </tr>
                `;
            }
        } catch (error) {
            console.error('Error loading check-in data:', error);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-danger">
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
            
            // Refresh all data
            this.loadCheckinData();
            this.loadCheckoutData();
            this.loadFlightOptionsForCheckin();
            this.loadFlightOptionsForCheckout();
            this.loadRecentReservations(); // Refresh recent reservations
            
        } catch (error) {
            console.error('Error checking in guest:', error);
            alert('Error checking in guest. Please try again.');
        }
    }

    async loadCheckoutData() {
        const dateInput = document.getElementById('checkoutDateFilter');
        const flightSelect = document.getElementById('checkoutFlightFilter');
        const tableBody = document.getElementById('checkoutTable');
        
        if (!tableBody) return;
        
        const date = dateInput ? dateInput.value : '';
        const flightFilter = flightSelect ? flightSelect.value : '';
        
        try {
            let query = this.db.collection('reservations')
                .where('status', '==', 'checked-in');
            
            const snapshot = await query.get();
            tableBody.innerHTML = '';
            
            if (snapshot.empty) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center text-muted">
                            No checked-in guests available
                        </td>
                    </tr>
                `;
                return;
            }
            
            let hasData = false;
            
            snapshot.forEach(doc => {
                const data = doc.data();
                
                if (date && data.checkinDate !== date) return;
                if (flightFilter && data.flightHotel !== flightFilter) return;
                
                hasData = true;
                const row = `
                    <tr>
                        <td>${data.guestName}</td>
                        <td>${data.flightHotel}</td>
                        <td>${data.eta}</td>
                        <td>${data.direction}</td>
                        <td>${data.checkinTime || 'N/A'}</td>
                        <td><span class="status-badge status-checkedin">Checked-In</span></td>
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
                        <td colspan="7" class="text-center text-muted">
                            No checked-in guests match the selected filters
                        </td>
                    </tr>
                `;
            }
        } catch (error) {
            console.error('Error loading check-out data:', error);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-danger">
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
            
            // Refresh all data
            this.loadCheckoutData();
            this.loadReportOptions();
            this.loadFlightOptionsForCheckout();
            this.loadRecentReservations(); // Refresh recent reservations
            
        } catch (error) {
            console.error('Error checking out guest:', error);
            alert('Error checking out guest. Please try again.');
        }
    }

    async loadReportOptions() {
        try {
            const snapshot = await this.db.collection('reservations')
                .where('status', '==', 'checked-out')
                .get();
            
            const flights = [...new Set(snapshot.docs.map(doc => doc.data().flightHotel))];
            const select = document.getElementById('reportFlightFilter');
            if (!select) return;
            
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
            
            if (flights.includes(currentValue)) {
                select.value = currentValue;
            }
        } catch (error) {
            console.error('Error loading report options:', error);
        }
    }

    async generateReport() {
        const fromDateInput = document.getElementById('reportFromDate');
        const toDateInput = document.getElementById('reportToDate');
        const flightSelect = document.getElementById('reportFlightFilter');
        
        if (!fromDateInput || !toDateInput) return;
        
        const fromDate = fromDateInput.value;
        const toDate = toDateInput.value;
        const flightFilter = flightSelect ? flightSelect.value : '';
        
        if (fromDate && toDate && fromDate > toDate) {
            alert('From date cannot be after To date');
            return;
        }
        
        try {
            let query = this.db.collection('reservations')
                .where('status', '==', 'checked-out');
            
            const snapshot = await query.get();
            const reservations = [];
            
            snapshot.forEach(doc => {
                const data = doc.data();
                
                if (fromDate && toDate) {
                    const checkoutDate = data.checkoutDate || data.checkoutDateTime;
                    if (!checkoutDate) return;
                    
                    const checkoutDateObj = new Date(checkoutDate);
                    const startDate = new Date(fromDate + 'T00:00:00');
                    const endDate = new Date(toDate + 'T23:59:59');
                    
                    if (checkoutDateObj < startDate || checkoutDateObj > endDate) {
                        return;
                    }
                }
                
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
        const printWindow = window.open('', '_blank');
        
        const currentDate = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        // Group by customer
        const reservationsByCustomer = {};
        reservations.forEach(res => {
            if (!reservationsByCustomer[res.customer]) {
                reservationsByCustomer[res.customer] = [];
            }
            reservationsByCustomer[res.customer].push(res);
        });
        
        let reportHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Guest Check-Out Report</title>
                <style>
                    @media print {
                        @page {
                            size: A4;
                            margin: 15mm;
                        }
                        body {
                            font-family: Arial, sans-serif;
                            font-size: 11px;
                            color: #000;
                            margin: 0;
                            padding: 0;
                        }
                        .report-container {
                            width: 100%;
                        }
                        .header-left {
                            float: left;
                            width: 100%;
                            margin-bottom: 15px;
                        }
                        .logo-container {
                            display: flex;
                            align-items: flex-start;
                            margin-bottom: 10px;
                        }
                        .company-logo {
                            width: 80px;
                            height: auto;
                            margin-right: 15px;
                        }
                        .company-info {
                            line-height: 1.3;
                            flex: 1;
                        }
                        .company-name {
                            font-size: 16px;
                            font-weight: bold;
                            margin: 0 0 3px 0;
                            color: #2c3e50;
                        }
                        .company-address {
                            font-size: 11px;
                            margin: 0 0 2px 0;
                        }
                        .report-details {
                            margin-top: 10px;
                            padding-top: 10px;
                            border-top: 1px solid #ddd;
                            clear: both;
                        }
                        .detail-row {
                            display: flex;
                            margin-bottom: 4px;
                        }
                        .detail-label {
                            font-weight: bold;
                            width: 70px;
                        }
                        .detail-value {
                            flex: 1;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin: 10px 0 15px 0;
                            page-break-inside: avoid;
                        }
                        th {
                            background-color: #f8f9fa;
                            color: #000;
                            padding: 6px 4px;
                            text-align: left;
                            border: 1px solid #ddd;
                            font-size: 10px;
                            font-weight: bold;
                        }
                        td {
                            padding: 5px 4px;
                            border: 1px solid #ddd;
                            font-size: 10px;
                        }
                        .customer-section {
                            margin-bottom: 20px;
                            page-break-inside: avoid;
                        }
                        .customer-name {
                            background-color: #e9ecef;
                            padding: 6px 10px;
                            font-weight: bold;
                            margin-bottom: 8px;
                            font-size: 12px;
                            border-left: 3px solid #3498db;
                        }
                        .footer {
                            margin-top: 30px;
                            page-break-inside: avoid;
                            padding-top: 15px;
                            border-top: 1px solid #ddd;
                        }
                        .signature-section {
                            width: 45%;
                            display: inline-block;
                            vertical-align: top;
                        }
                        .signature-line {
                            margin-top: 30px;
                            border-top: 1px solid #000;
                            width: 180px;
                            padding-top: 4px;
                            font-size: 10px;
                        }
                        .no-print {
                            display: none;
                        }
                        .clearfix {
                            clear: both;
                        }
                    }
                    @media screen {
                        body {
                            font-family: Arial, sans-serif;
                            font-size: 12px;
                            padding: 20px;
                            background: #f5f5f5;
                        }
                        .report-container {
                            max-width: 210mm;
                            margin: 0 auto;
                            background: white;
                            padding: 20px;
                            box-shadow: 0 0 10px rgba(0,0,0,0.1);
                        }
                        .header-left {
                            float: left;
                            width: 100%;
                            margin-bottom: 20px;
                        }
                        .logo-container {
                            display: flex;
                            align-items: flex-start;
                            margin-bottom: 15px;
                        }
                        .company-logo {
                            width: 80px;
                            height: auto;
                            margin-right: 20px;
                        }
                        .company-info {
                            line-height: 1.4;
                            flex: 1;
                        }
                        .company-name {
                            font-size: 18px;
                            font-weight: bold;
                            margin: 0 0 5px 0;
                            color: #2c3e50;
                        }
                        .company-address {
                            font-size: 12px;
                            margin: 0 0 3px 0;
                        }
                        .report-details {
                            margin-top: 15px;
                            padding-top: 12px;
                            border-top: 1px solid #ddd;
                            clear: both;
                        }
                        .detail-row {
                            display: flex;
                            margin-bottom: 5px;
                        }
                        .detail-label {
                            font-weight: bold;
                            width: 80px;
                        }
                        .detail-value {
                            flex: 1;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin: 15px 0 20px 0;
                        }
                        th {
                            background-color: #f8f9fa;
                            color: #000;
                            padding: 8px;
                            text-align: left;
                            border: 1px solid #ddd;
                        }
                        td {
                            padding: 7px;
                            border: 1px solid #ddd;
                        }
                        .customer-section {
                            margin-bottom: 25px;
                        }
                        .customer-name {
                            background-color: #e9ecef;
                            padding: 8px 12px;
                            font-weight: bold;
                            margin-bottom: 10px;
                            font-size: 13px;
                            border-left: 4px solid #3498db;
                        }
                        .footer {
                            margin-top: 40px;
                            padding-top: 20px;
                            border-top: 1px solid #ddd;
                        }
                        .signature-section {
                            width: 45%;
                            display: inline-block;
                            vertical-align: top;
                        }
                        .signature-line {
                            margin-top: 40px;
                            border-top: 1px solid #000;
                            width: 200px;
                            padding-top: 5px;
                        }
                        .print-buttons {
                            text-align: center;
                            margin-top: 20px;
                            padding: 20px;
                            background: #f8f9fa;
                            border-radius: 5px;
                        }
                        .clearfix {
                            clear: both;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="report-container">
                    <!-- Header Left -->
                    <div class="header-left">
                        <div class="logo-container">
                            <img src="macl.png" alt="Company Logo" class="company-logo" onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\"width:80px;height:60px;border:1px solid #ccc;text-align:center;line-height:60px;font-size:10px;\"></div>
                            <div class="company-info">
                                <div class="company-name">Vilu Business Lounge</div>
                                <div class="company-address">Seaplane Terminal</div>
                                <div class="company-address">Velana International Airport</div>
                                <div class="company-address">Hulhule: 22000</div>
                                <div class="company-address">Rep of Maldives</div>
                                <div class="company-address">T: 3337117 / 3331773 | M: 7288007</div>
                                <div class="company-address">W: www.macl.aero / E : vilu.lounge@macl.aero</div>
                            </div>
                        </div>
                        
                        <div class="report-details">
                            <div class="detail-row">
                                <div class="detail-label">Date:</div>
                                <div class="detail-value">${currentDate}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="clearfix"></div>
                    
                    <!-- Report Content -->
        `;
        
        Object.entries(reservationsByCustomer).forEach(([customer, customerReservations]) => {
            reportHTML += `
                <div class="customer-section">
                    <div class="customer-name">Customer: ${customer}</div>
                    
                    <table>
                        <thead>
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
            
            customerReservations.forEach(res => {
                reportHTML += `
                    <tr>
                        <td>${res.guestName}</td>
                        <td>${res.flightHotel}</td>
                        <td>${res.eta}</td>
                        <td>${res.direction}</td>
                        <td>${res.checkinTime || 'N/A'}</td>
                        <td>${res.checkoutTime || 'N/A'}</td>
                        <td></td>
                    </tr>
                `;
            });
            
            reportHTML += `
                        </tbody>
                    </table>
                </div>
            `;
        });
        
        reportHTML += `
                    <!-- Footer Signatures -->
                    <div class="footer">
                        <div class="signature-section">
                            <div class="detail-row">
                                <div class="detail-label">Prepared by:</div>
                                <div class="detail-value">${this.currentUser.name}</div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">RC No:</div>
                                <div class="detail-value">${this.currentUser.RCNo}</div>
                            </div>
                            <div class="signature-line">Signature</div>
                        </div>
                        
                        <div class="signature-section" style="float: right;">
                            <div class="detail-row">
                                <div class="detail-label">Checked by:</div>
                                <div class="detail-value">_____________________</div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">RC No:</div>
                                <div class="detail-value">_____________________</div>
                            </div>
                            <div class="signature-line">Signature</div>
                        </div>
                        <div class="clearfix"></div>
                    </div>
                    
                    <!-- Print Buttons (only for screen) -->
                    <div class="print-buttons no-print">
                        <button onclick="window.print()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                            Print Report
                        </button>
                        <button onclick="window.close()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            Close Window
                        </button>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        printWindow.document.write(reportHTML);
        printWindow.document.close();
        printWindow.focus();
    }
}

// Initialize application
const app = new ReservationSystem();
