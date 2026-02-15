const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// In-memory data store
let events = [
  {
    id: 1,
    type: 'concert',
    name: 'Rock Legends Live',
    artist: 'The Thunder Band',
    venue: 'O2 Arena, London',
    date: '2026-03-15',
    time: '19:00',
    price: 65.00,
    availableTickets: 150,
    description: 'Experience an unforgettable night of rock music with The Thunder Band!'
  },
  {
    id: 2,
    type: 'film',
    name: 'Classic Cinema Night',
    artist: 'The Godfather',
    venue: 'BFI Southbank, London',
    date: '2026-03-20',
    time: '20:00',
    price: 12.50,
    availableTickets: 200,
    description: 'Join us for a special screening of this timeless masterpiece.'
  },
  {
    id: 3,
    type: 'comedy',
    name: 'Stand-Up Spectacular',
    artist: 'Sarah Johnson',
    venue: 'The Comedy Store, Manchester',
    date: '2026-03-25',
    time: '21:00',
    price: 28.00,
    availableTickets: 80,
    description: 'Get ready to laugh until your sides hurt with Sarah Johnson!'
  },
  {
    id: 4,
    type: 'concert',
    name: 'Jazz Night',
    artist: 'Blue Note Quintet',
    venue: 'Ronnie Scott\'s, London',
    date: '2026-04-01',
    time: '20:30',
    price: 42.00,
    availableTickets: 100,
    description: 'An evening of smooth jazz with the acclaimed Blue Note Quintet.'
  },
  {
    id: 5,
    type: 'film',
    name: 'Sci-Fi Marathon',
    artist: 'Blade Runner & The Matrix',
    venue: 'Odeon Leicester Square, London',
    date: '2026-04-10',
    time: '18:00',
    price: 16.50,
    availableTickets: 120,
    description: 'Double feature of two groundbreaking sci-fi films.'
  },
  {
    id: 6,
    type: 'comedy',
    name: 'Improv Night',
    artist: 'The Comedy Crew',
    venue: 'The Glee Club, Birmingham',
    date: '2026-04-15',
    time: '19:30',
    price: 20.00,
    availableTickets: 60,
    description: 'Hilarious improvised comedy based on audience suggestions!'
  }
];

let purchases = [];
let purchaseIdCounter = 1;

// API Routes

// GET all events
app.get('/api/events', (req, res) => {
  const { type } = req.query;
  let filteredEvents = events;
  
  if (type) {
    filteredEvents = events.filter(event => event.type === type);
  }
  
  res.json(filteredEvents);
});

// GET single event by ID
app.get('/api/events/:id', (req, res) => {
  const eventId = parseInt(req.params.id);
  const event = events.find(e => e.id === eventId);
  
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  
  res.json(event);
});

// POST purchase tickets
app.post('/api/tickets/purchase', (req, res) => {
  const { eventId, quantity, customerName, customerEmail } = req.body;
  
  // Validation
  if (!eventId || !quantity || !customerName || !customerEmail) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const event = events.find(e => e.id === parseInt(eventId));
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  
  if (quantity > event.availableTickets) {
    return res.status(400).json({ error: 'Not enough tickets available' });
  }
  
  if (quantity < 1) {
    return res.status(400).json({ error: 'Quantity must be at least 1' });
  }
  
  // Process purchase
  event.availableTickets -= quantity;
  const totalPrice = event.price * quantity;
  
  const purchase = {
    id: purchaseIdCounter++,
    eventId: event.id,
    eventName: event.name,
    quantity,
    customerName,
    customerEmail,
    totalPrice,
    purchaseDate: new Date().toISOString()
  };
  
  purchases.push(purchase);
  
  res.status(201).json({
    success: true,
    purchase
  });
});

// GET all purchases
app.get('/api/tickets', (req, res) => {
  res.json(purchases);
});

// GET purchase by ID
app.get('/api/tickets/:id', (req, res) => {
  const purchaseId = parseInt(req.params.id);
  const purchase = purchases.find(p => p.id === purchaseId);
  
  if (!purchase) {
    return res.status(404).json({ error: 'Purchase not found' });
  }
  
  res.json(purchase);
});

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Ticketyboo server running on http://localhost:${PORT}`);
});
