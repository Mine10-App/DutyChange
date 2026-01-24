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
    
    // Get all unique customers for the summary
    const allCustomers = Object.keys(reservationsByCustomer);
    
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
                        width: 70%;
                        margin-bottom: 15px;
                    }
                    .logo-container {
                        display: flex;
                        align-items: center;
                        margin-bottom: 8px;
                    }
                    .company-logo {
                        width: 80px;
                        height: auto;
                        margin-right: 15px;
                    }
                    .company-info {
                        line-height: 1.3;
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
                        padding-top: 8px;
                        border-top: 1px solid #ddd;
                    }
                    .detail-row {
                        display: flex;
                        margin-bottom: 3px;
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
                        margin-top: 25px;
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
                        margin-top: 25px;
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
                    .summary {
                        margin-bottom: 15px;
                        font-size: 11px;
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
                        width: 70%;
                        margin-bottom: 20px;
                    }
                    .logo-container {
                        display: flex;
                        align-items: center;
                        margin-bottom: 15px;
                    }
                    .company-logo {
                        width: 80px;
                        height: auto;
                        margin-right: 20px;
                    }
                    .company-info {
                        line-height: 1.4;
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
                        margin-top: 30px;
                        padding-top: 20px;
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
                    .summary {
                        margin-bottom: 20px;
                        font-size: 12px;
                    }
                }
            </style>
        </head>
        <body>
            <div class="report-container">
                <!-- Header Left -->
                <div class="header-left">
                    <div class="logo-container">
                        <img src="macl.png" alt="Company Logo" class="company-logo" onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\"width:80px;height:60px;border:1px solid #ccc;text-align:center;line-height:60px;font-size:10px;\">LOGO</div>'">
                        <div class="company-info">
                            <div class="company-name">Hotel Management System</div>
                            <div class="company-address">123 Hotel Street, City, Country</div>
                            <div class="company-address">Phone: +123 456 7890</div>
                            <div class="company-address">Email: info@hotel.com</div>
                        </div>
                    </div>
                    
                    <div class="report-details">
                        <div class="detail-row">
                            <div class="detail-label">Date:</div>
                            <div class="detail-value">${currentDate}</div>
                        </div>
                        ${fromDate && toDate ? `
                        <div class="detail-row">
                            <div class="detail-label">Period:</div>
                            <div class="detail-value">${new Date(fromDate).toLocaleDateString()} to ${new Date(toDate).toLocaleDateString()}</div>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="clearfix"></div>
                
                <!-- Summary -->
                <div class="summary">
                    <div class="detail-row">
                        <div class="detail-label">Total Guests:</div>
                        <div class="detail-value">${reservations.length}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Customers:</div>
                        <div class="detail-value">${allCustomers.join(', ')}</div>
                    </div>
                </div>
                
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

// Initialize application
const app = new ReservationSystem();
