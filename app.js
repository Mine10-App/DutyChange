showDashboard() {
    document.getElementById('loginScreen').classList.add('d-none');
    document.getElementById('dashboard').classList.remove('d-none');
    
    // Display user info
    document.getElementById('userName').textContent = this.currentUser.name;
    document.getElementById('userLevel').textContent = this.currentUser.Level;
    document.getElementById('userRC').textContent = this.currentUser.RCNo;
    
    // Set default dates using JavaScript
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('reservationDate').value = today;
    document.getElementById('checkinDateFilter').value = today;
    document.getElementById('checkoutDateFilter').value = today;
    document.getElementById('reportFromDate').value = today;
    document.getElementById('reportToDate').value = today;
    
    // Load initial data
    this.loadCheckinData();
    this.loadCheckoutData();
    this.loadFlightOptionsForCheckin();
    this.loadFlightOptionsForCheckout();
    this.loadReportOptions();
}
