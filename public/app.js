// State
let currentFilter = 'all';
let events = [];

// DOM Elements
const eventsList = document.getElementById('eventsList');
const filterButtons = document.querySelectorAll('.filter-btn');
const eventModal = document.getElementById('eventModal');
const confirmationModal = document.getElementById('confirmationModal');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadEvents();
    setupFilterButtons();
    setupModals();
});

// Setup filter buttons
function setupFilterButtons() {
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.type;
            displayEvents();
        });
    });
}

// Setup modals
function setupModals() {
    const closeButtons = document.querySelectorAll('.close');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            eventModal.style.display = 'none';
            confirmationModal.style.display = 'none';
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target === eventModal) {
            eventModal.style.display = 'none';
        }
        if (e.target === confirmationModal) {
            confirmationModal.style.display = 'none';
        }
    });
}

// Load events from API
async function loadEvents() {
    try {
        const response = await fetch('/api/events');
        events = await response.json();
        displayEvents();
    } catch (error) {
        eventsList.innerHTML = '<div class="error-message">Failed to load events. Please try again later.</div>';
        console.error('Error loading events:', error);
    }
}

// Display events
function displayEvents() {
    let filteredEvents = events;
    
    if (currentFilter !== 'all') {
        filteredEvents = events.filter(event => event.type === currentFilter);
    }
    
    if (filteredEvents.length === 0) {
        eventsList.innerHTML = '<div class="loading">No events found.</div>';
        return;
    }
    
    eventsList.innerHTML = filteredEvents.map(event => `
        <div class="event-card" onclick="showEventDetails(${event.id})">
            <span class="event-type ${event.type}">${event.type}</span>
            <h3>${event.name}</h3>
            <p class="event-artist">${event.artist}</p>
            <p class="event-details">📍 ${event.venue}</p>
            <p class="event-details">📅 ${formatDate(event.date)} at ${event.time}</p>
            <p class="event-price">£${event.price.toFixed(2)}</p>
            <p class="event-availability">${event.availableTickets} tickets available</p>
        </div>
    `).join('');
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

// Show event details in modal
async function showEventDetails(eventId) {
    try {
        const response = await fetch(`/api/events/${eventId}`);
        const event = await response.json();
        
        const eventDetails = document.getElementById('eventDetails');
        eventDetails.innerHTML = `
            <div class="modal-event-header">
                <span class="event-type ${event.type}">${event.type}</span>
                <h2>${event.name}</h2>
                <p class="event-artist">${event.artist}</p>
            </div>
            
            <div class="event-info">
                <p><strong>📍 Venue:</strong> ${event.venue}</p>
                <p><strong>📅 Date:</strong> ${formatDate(event.date)}</p>
                <p><strong>🕐 Time:</strong> ${event.time}</p>
                <p><strong>💵 Price:</strong> £${event.price.toFixed(2)} per ticket</p>
                <p><strong>🎫 Available:</strong> ${event.availableTickets} tickets</p>
            </div>
            
            <div class="event-description">
                <p>${event.description}</p>
            </div>
            
            <div class="purchase-form">
                <h3>Purchase Tickets</h3>
                <form id="purchaseForm" onsubmit="handlePurchase(event, ${event.id})">
                    <div class="form-group">
                        <label for="quantity">Number of Tickets:</label>
                        <input 
                            type="number" 
                            id="quantity" 
                            name="quantity" 
                            min="1" 
                            max="${event.availableTickets}" 
                            value="1" 
                            required
                            onchange="updateTotalPrice(${event.price})"
                        >
                    </div>
                    
                    <div class="form-group">
                        <label for="customerName">Full Name:</label>
                        <input 
                            type="text" 
                            id="customerName" 
                            name="customerName" 
                            required
                            placeholder="John Doe"
                        >
                    </div>
                    
                    <div class="form-group">
                        <label for="customerEmail">Email:</label>
                        <input 
                            type="email" 
                            id="customerEmail" 
                            name="customerEmail" 
                            required
                            placeholder="john@example.com"
                        >
                    </div>
                    
                    <div class="payment-section">
                        <h4>💳 Payment Information</h4>
                        
                        <div class="form-group">
                            <label for="cardNumber">Card Number:</label>
                            <input 
                                type="text" 
                                id="cardNumber" 
                                name="cardNumber" 
                                required
                                placeholder="1234 5678 9012 3456"
                                maxlength="23"
                                autocomplete="cc-number"
                                oninput="formatCardNumber(this)"
                            >
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="cardExpiry">Expiry Date:</label>
                                <input 
                                    type="text" 
                                    id="cardExpiry" 
                                    name="cardExpiry" 
                                    required
                                    placeholder="MM/YY"
                                    maxlength="5"
                                    autocomplete="cc-exp"
                                    oninput="formatCardExpiry(this)"
                                >
                            </div>
                            
                            <div class="form-group">
                                <label for="cardCvv">CVV:</label>
                                <input 
                                    type="text" 
                                    id="cardCvv" 
                                    name="cardCvv" 
                                    required
                                    placeholder="123"
                                    maxlength="4"
                                    autocomplete="cc-csc"
                                    oninput="formatCardCvv(this)"
                                >
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="cardholderName">Cardholder Name:</label>
                            <input 
                                type="text" 
                                id="cardholderName" 
                                name="cardholderName" 
                                required
                                placeholder="JOHN DOE"
                                autocomplete="cc-name"
                            >
                        </div>
                    </div>
                    
                    <p class="total-price">
                        Total: £<span id="totalPrice">${event.price.toFixed(2)}</span>
                    </p>
                    
                    <button type="submit" class="btn btn-primary">Complete Purchase</button>
                </form>
            </div>
        `;
        
        eventModal.style.display = 'block';
    } catch (error) {
        console.error('Error loading event details:', error);
        alert('Failed to load event details. Please try again.');
    }
}

// Update total price
function updateTotalPrice(pricePerTicket) {
    const quantity = document.getElementById('quantity').value;
    const total = pricePerTicket * quantity;
    document.getElementById('totalPrice').textContent = total.toFixed(2);
}

// Format card number with spaces
function formatCardNumber(input) {
    let value = input.value.replace(/\s/g, '').replace(/\D/g, '');
    let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
    input.value = formattedValue;
}

// Format card expiry as MM/YY
function formatCardExpiry(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length >= 2) {
        value = value.slice(0, 2) + '/' + value.slice(2, 4);
    }
    input.value = value;
}

// Format CVV (numbers only)
function formatCardCvv(input) {
    input.value = input.value.replace(/\D/g, '');
}

// Handle purchase
async function handlePurchase(event, eventId) {
    event.preventDefault();
    
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Processing...';
    
    const purchaseData = {
        eventId: eventId,
        quantity: parseInt(form.quantity.value),
        customerName: form.customerName.value,
        customerEmail: form.customerEmail.value,
        cardNumber: form.cardNumber.value,
        cardExpiry: form.cardExpiry.value,
        cardCvv: form.cardCvv.value,
        cardholderName: form.cardholderName.value
    };
    
    try {
        const response = await fetch('/api/tickets/purchase', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(purchaseData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showConfirmation(result.purchase);
            eventModal.style.display = 'none';
            loadEvents(); // Refresh events to show updated availability
        } else {
            alert('Error: ' + result.error);
            submitButton.disabled = false;
            submitButton.textContent = 'Complete Purchase';
        }
    } catch (error) {
        console.error('Error processing purchase:', error);
        alert('Failed to process purchase. Please try again.');
        submitButton.disabled = false;
        submitButton.textContent = 'Complete Purchase';
    }
}

// Show confirmation
function showConfirmation(purchase) {
    const confirmationDetails = document.getElementById('confirmationDetails');
    confirmationDetails.innerHTML = `
        <div class="confirmation-content">
            <div class="confirmation-icon">✅</div>
            <h2>Purchase Successful!</h2>
            <p>Thank you for your purchase. Your tickets have been confirmed.</p>
            
            <div class="confirmation-details">
                <p><strong>Confirmation ID:</strong> #${purchase.id}</p>
                <p><strong>Event:</strong> ${purchase.eventName}</p>
                <p><strong>Tickets:</strong> ${purchase.quantity}</p>
                <p><strong>Total Paid:</strong> £${purchase.totalPrice.toFixed(2)}</p>
                <p><strong>Name:</strong> ${purchase.customerName}</p>
                <p><strong>Email:</strong> ${purchase.customerEmail}</p>
                <p><strong>Payment Method:</strong> ${purchase.cardMasked}</p>
                <p><strong>Cardholder:</strong> ${purchase.cardholderName}</p>
            </div>
            
            <p>Thank you for your purchase!</p>
            
            <button class="btn btn-primary" onclick="confirmationModal.style.display='none'">Close</button>
        </div>
    `;
    
    confirmationModal.style.display = 'block';
}
