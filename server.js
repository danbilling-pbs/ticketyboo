const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');

// ─── Ethereal email transport ───────────────────────────────────────────────
let transporter = null;

async function initEmailTransport() {
  try {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass }
    });
    console.log('\n📧 Ethereal email ready — captured emails appear at:');
    console.log('   https://ethereal.email/messages');
    console.log('   Inbox: ' + testAccount.user + '\n');
  } catch (err) {
    console.warn('⚠️  Could not initialise Ethereal transport:', err.message);
  }
}

async function sendEmail({ to, subject, html }) {
  if (!transporter) throw new Error('Email transport not initialised');
  const info = await transporter.sendMail({
    from: '"Ticketyboo" <no-reply@ticketyboo.example>',
    to,
    subject,
    html
  });
  return nodemailer.getTestMessageUrl(info); // Ethereal preview URL
}

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
    venue: 'Broadway Cinema, Nottingham',
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
    venue: 'Jam Café, Nottingham',
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
    venue: 'Showcase Cinema, Bristol',
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
    venue: 'Komedia, Bath',
    date: '2026-04-15',
    time: '19:30',
    price: 20.00,
    availableTickets: 60,
    description: 'Hilarious improvised comedy based on audience suggestions!'
  }
];

let purchases = [];
let purchaseIdCounter = 1;

// In-memory auth store
let users = [];
let sessions = [];
let resetTokens = [];
let pendingTwoFa = [];
let userIdCounter = 1;
let cardIdCounter = 1;

function generateToken() {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

// Returns a user object safe to send to the client (no password)
function safeUser(user) {
  return {
    id:            user.id,
    username:      user.username,
    firstName:     user.firstName,
    middleName:    user.middleName   || '',
    lastName:      user.lastName,
    knownAs:       user.knownAs      || '',
    title:         user.title        || '',
    customerName:  (user.title && user.title !== 'prefer-not' ? user.title + ' ' : '') + user.firstName + (user.middleName ? ' ' + user.middleName : '') + ' ' + user.lastName,
    gender:        user.gender        || '',
    marketingPrefs: user.marketingPrefs || { email: false, sms: false, phone: false, post: false },
    customerEmail: user.customerEmail,
    phone:        user.phone        || '',
    addressLine1: user.addressLine1 || '',
    addressLine2: user.addressLine2 || '',
    postcode:     user.postcode     || '',
    city:         user.city         || '',
    county:       user.county       || '',
    country:         user.country         || '',
    twoFactorEnabled: !!user.twoFactorEnabled,
    savedCards:   (user.savedCards || []).map(c => ({
      id:             c.id,
      nickname:       c.nickname,
      cardholderName: c.cardholderName,
      cardLast4:      c.cardLast4,
      cardMasked:     c.cardMasked,
      cardExpiry:     c.cardExpiry,
      createdAt:      c.createdAt
    }))
  };
}

// ─── Password complexity ────────────────────────────────────────────────────
// Returns a descriptive error string, or null if the password is valid.
function validatePasswordComplexity(password) {
  if (!password || password.length < 8)   return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password))            return 'Password must contain at least one uppercase letter (A–Z).';
  if (!/[a-z]/.test(password))            return 'Password must contain at least one lowercase letter (a–z).';
  if (!/[0-9]/.test(password))            return 'Password must contain at least one number (0–9).';
  if (!/[!@#$%^&*]/.test(password))       return 'Password must contain at least one special character (! @ # $ % ^ & *).';
  return null;
}

// Auth middleware (used by session check endpoint)
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = auth.substring(7);
  const session = sessions.find(s => s.token === token);
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  const user = users.find(u => u.id === session.userId);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  req.user = user;
  next();
}

// API Routes

// POST register
app.post('/api/auth/register', (req, res) => {
  const {
    username, password, title, firstName, middleName, lastName, knownAs, gender, marketingPrefs, customerEmail,
    phone, addressLine1, addressLine2, postcode, city, county, country
  } = req.body;

  if (!username || !password || !firstName || !lastName || !customerEmail) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (users.find(u => u.username === username)) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  const passwordError = validatePasswordComplexity(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  const user = {
    id: userIdCounter++,
    username,
    password,
    title:        title        || '',
    firstName,
    middleName:   middleName   || '',
    lastName,
    knownAs:      knownAs      || '',
    gender:       gender       || '',
    marketingPrefs: {
      email: !!(marketingPrefs && marketingPrefs.email),
      sms:   !!(marketingPrefs && marketingPrefs.sms),
      phone: !!(marketingPrefs && marketingPrefs.phone),
      post:  !!(marketingPrefs && marketingPrefs.post)
    },
    customerEmail,
    phone:        phone        || '',
    addressLine1: addressLine1 || '',
    addressLine2: addressLine2 || '',
    postcode:     postcode     || '',
    city:         city         || '',
    county:       county       || '',
    country:          country      || '',
    twoFactorEnabled: false,
    savedCards:       []
  };
  users.push(user);

  const token = generateToken();
  sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() });

  res.status(201).json({
    success: true,
    token,
    user: safeUser(user)
  });
});

// POST login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = users.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // ── 2FA: generate OTP, send email, return challenge ─────────────────────
  if (user.twoFactorEnabled) {
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const challengeId = generateToken();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    pendingTwoFa = pendingTwoFa.filter(c => c.userId !== user.id);
    pendingTwoFa.push({ challengeId, userId: user.id, otp, expiresAt });

    let previewUrl = null;
    try {
      previewUrl = await sendEmail({
        to: user.customerEmail,
        subject: 'Ticketyboo — Your verification code',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <h2 style="color:#667eea">&#127915; Ticketyboo</h2>
            <p>Hi ${user.knownAs || user.firstName},</p>
            <p>Your sign-in verification code is:</p>
            <div style="font-size:2.5rem;font-weight:bold;letter-spacing:0.2em;text-align:center;
                        padding:1rem;background:#f0f4ff;border-radius:8px;margin:1.5rem 0">${otp}</div>
            <p>This code expires in <strong>10 minutes</strong>.</p>
            <p style="color:#888;font-size:0.85rem">If you did not attempt to sign in, you can ignore this email.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:1.5rem 0">
            <p style="color:#aaa;font-size:0.8rem">Ticketyboo &mdash; Test Automation Training App</p>
          </div>`
      });
    } catch (err) {
      console.error('Failed to send 2FA email:', err.message);
    }

    return res.json({ requiresTwoFa: true, challengeId, previewUrl });
  }

  const token = generateToken();
  sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() });

  res.json({
    success: true,
    token,
    user: safeUser(user)
  });
});

// POST verify 2FA code
app.post('/api/auth/verify-2fa', (req, res) => {
  const { challengeId, otp } = req.body;
  if (!challengeId || !otp) {
    return res.status(400).json({ error: 'Challenge ID and verification code are required.' });
  }

  const challenge = pendingTwoFa.find(c => c.challengeId === challengeId);
  if (!challenge) {
    return res.status(400).json({ error: 'Invalid or expired challenge. Please sign in again.' });
  }

  if (Date.now() > challenge.expiresAt) {
    pendingTwoFa = pendingTwoFa.filter(c => c.challengeId !== challengeId);
    return res.status(400).json({ error: 'Verification code has expired. Please sign in again.' });
  }

  if (challenge.otp !== otp.trim()) {
    return res.status(400).json({ error: 'Incorrect verification code. Please try again.' });
  }

  const user = users.find(u => u.id === challenge.userId);
  if (!user) {
    return res.status(400).json({ error: 'User not found.' });
  }

  pendingTwoFa = pendingTwoFa.filter(c => c.challengeId !== challengeId);
  const token = generateToken();
  sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() });
  res.json({ success: true, token, user: safeUser(user) });
});

// POST password reset — request
app.post('/api/auth/reset-password/request', async (req, res) => {
  const { username, customerEmail } = req.body;
  if (!username || !customerEmail) {
    return res.status(400).json({ error: 'Username and email address are required.' });
  }

  const user = users.find(u => u.username === username && u.customerEmail === customerEmail);
  if (!user) {
    return res.status(404).json({ error: 'No account found with that username and email address.' });
  }

  // Invalidate any existing reset tokens for this user
  resetTokens = resetTokens.filter(t => t.userId !== user.id);

  const token = Math.random().toString(36).substring(2, 10).toUpperCase();
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes
  resetTokens.push({ token, userId: user.id, expiresAt });

  let previewUrl = null;
  try {
    previewUrl = await sendEmail({
      to: user.customerEmail,
      subject: 'Ticketyboo — Reset your password',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#667eea">&#127915; Ticketyboo</h2>
          <p>Hi ${user.knownAs || user.firstName},</p>
          <p>We received a request to reset your password. Your reset code is:</p>
          <div style="font-size:2rem;font-weight:bold;letter-spacing:0.2em;text-align:center;
                      padding:1rem;background:#f0f4ff;border-radius:8px;margin:1.5rem 0">${token}</div>
          <p>This code expires in <strong>15 minutes</strong>.</p>
          <p style="color:#888;font-size:0.85rem">If you did not request a password reset, you can ignore this email.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:1.5rem 0">
          <p style="color:#aaa;font-size:0.8rem">Ticketyboo &mdash; Test Automation Training App</p>
        </div>`
    });
  } catch (err) {
    console.error('Failed to send reset email:', err.message);
  }

  res.json({ success: true, previewUrl });
});

// POST password reset — confirm
app.post('/api/auth/reset-password/confirm', (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Reset token and new password are required.' });
  }

  const entry = resetTokens.find(t => t.token === token.trim().toUpperCase());
  if (!entry) {
    return res.status(400).json({ error: 'Invalid reset token.' });
  }

  if (Date.now() > entry.expiresAt) {
    resetTokens = resetTokens.filter(t => t.token !== entry.token);
    return res.status(400).json({ error: 'Reset token has expired. Please request a new one.' });
  }

  const passwordError = validatePasswordComplexity(newPassword);
  if (passwordError) return res.status(400).json({ error: passwordError });

  const user = users.find(u => u.id === entry.userId);
  if (!user) return res.status(400).json({ error: 'User not found.' });

  user.password = newPassword;
  resetTokens = resetTokens.filter(t => t.token !== entry.token);
  res.json({ success: true });
});

// POST logout
app.post('/api/auth/logout', (req, res) => {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.substring(7);
    sessions = sessions.filter(s => s.token !== token);
  }
  res.json({ success: true });
});

// GET session check
app.get('/api/auth/session', requireAuth, (req, res) => {
  res.json({ user: safeUser(req.user) });
});

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
  const { eventId, quantity, customerName, customerEmail, cardNumber, cardExpiry, cardCvv, cardholderName } = req.body;
  
  // Validation
  if (!eventId || !quantity || !customerName || !customerEmail) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Validate payment card fields
  if (!cardNumber || !cardExpiry || !cardCvv || !cardholderName) {
    return res.status(400).json({ error: 'Missing payment card information' });
  }
  
  // Basic card validation
  const cardNumberClean = cardNumber.replace(/\s/g, '');
  if (cardNumberClean.length < 13 || cardNumberClean.length > 19) {
    return res.status(400).json({ error: 'Invalid card number' });
  }
  
  if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
    return res.status(400).json({ error: 'Invalid expiry date format (MM/YY)' });
  }
  
  // Validate expiry date is not in the past
  const [expMonth, expYear] = cardExpiry.split('/').map(num => parseInt(num, 10));
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear() % 100; // Get last 2 digits
  const currentMonth = currentDate.getMonth() + 1;
  
  if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
    return res.status(400).json({ error: 'Card has expired' });
  }
  
  if (!/^\d{3,4}$/.test(cardCvv)) {
    return res.status(400).json({ error: 'Invalid CVV' });
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
  
  // Mask card number for security (show only last 4 digits)
  const maskedCardNumber = '**** **** **** ' + cardNumberClean.slice(-4);
  
  const purchase = {
    id: purchaseIdCounter++,
    eventId: event.id,
    eventName: event.name,
    quantity,
    customerName,
    customerEmail,
    totalPrice,
    cardholderName,
    cardLast4: cardNumberClean.slice(-4),
    cardMasked: maskedCardNumber,
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

// ─── Account endpoints ──────────────────────────────────────────────────────

// GET account profile
app.get('/api/account', requireAuth, (req, res) => {
  res.json({ user: safeUser(req.user) });
});

// PUT account profile (also handles optional username change)
app.put('/api/account', requireAuth, (req, res) => {
  const user = req.user;
  const {
    username, title, firstName, middleName, lastName, knownAs, gender,
    customerEmail, phone, addressLine1, addressLine2, postcode, city, county, country,
    marketingPrefs, twoFactorEnabled
  } = req.body;

  if (!firstName || !lastName || !customerEmail) {
    return res.status(400).json({ error: 'First name, last name, and email are required.' });
  }

  if (username && username !== user.username) {
    if (users.find(u => u.username === username && u.id !== user.id)) {
      return res.status(409).json({ error: 'Username already taken.' });
    }
    user.username = username;
  }

  if (title        !== undefined) user.title        = title;
  user.firstName    = firstName;
  if (middleName   !== undefined) user.middleName   = middleName;
  user.lastName     = lastName;
  if (knownAs      !== undefined) user.knownAs      = knownAs;
  if (gender       !== undefined) user.gender       = gender;
  user.customerEmail = customerEmail;
  if (phone        !== undefined) user.phone        = phone;
  if (addressLine1 !== undefined) user.addressLine1 = addressLine1;
  if (addressLine2 !== undefined) user.addressLine2 = addressLine2;
  if (postcode     !== undefined) user.postcode     = postcode;
  if (city         !== undefined) user.city         = city;
  if (county       !== undefined) user.county       = county;
  if (country            !== undefined) user.country          = country;
  if (twoFactorEnabled   !== undefined) user.twoFactorEnabled = !!twoFactorEnabled;
  if (marketingPrefs) {
    user.marketingPrefs = {
      email: !!marketingPrefs.email,
      sms:   !!marketingPrefs.sms,
      phone: !!marketingPrefs.phone,
      post:  !!marketingPrefs.post
    };
  }

  res.json({ success: true, user: safeUser(user) });
});

// PUT change password
app.put('/api/account/password', requireAuth, (req, res) => {
  const user = req.user;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required.' });
  }

  if (user.password !== currentPassword) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }

  const passwordError = validatePasswordComplexity(newPassword);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  user.password = newPassword;
  res.json({ success: true });
});

// GET saved cards
app.get('/api/account/cards', requireAuth, (req, res) => {
  const cards = (req.user.savedCards || []).map(c => ({
    id:             c.id,
    nickname:       c.nickname,
    cardholderName: c.cardholderName,
    cardLast4:      c.cardLast4,
    cardMasked:     c.cardMasked,
    cardExpiry:     c.cardExpiry,
    createdAt:      c.createdAt
  }));
  res.json({ cards });
});

// POST add saved card
app.post('/api/account/cards', requireAuth, (req, res) => {
  const user = req.user;
  const { nickname, cardNumber, cardExpiry, cardholderName } = req.body;

  if (!cardNumber || !cardExpiry || !cardholderName) {
    return res.status(400).json({ error: 'Card number, expiry date, and cardholder name are required.' });
  }

  const cardNumberClean = cardNumber.replace(/\s/g, '');
  if (cardNumberClean.length < 13 || cardNumberClean.length > 19) {
    return res.status(400).json({ error: 'Invalid card number.' });
  }

  if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
    return res.status(400).json({ error: 'Invalid expiry date format (MM/YY).' });
  }

  const [expMonth, expYear] = cardExpiry.split('/').map(n => parseInt(n, 10));
  const now = new Date();
  const currentYear  = now.getFullYear() % 100;
  const currentMonth = now.getMonth() + 1;
  if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
    return res.status(400).json({ error: 'Card has expired.' });
  }

  if (!user.savedCards) user.savedCards = [];

  const card = {
    id:             cardIdCounter++,
    nickname:       nickname ? nickname.trim() : '',
    cardholderName: cardholderName.trim().toUpperCase(),
    cardLast4:      cardNumberClean.slice(-4),
    cardMasked:     '**** **** **** ' + cardNumberClean.slice(-4),
    cardExpiry,
    createdAt:      new Date().toISOString()
  };

  user.savedCards.push(card);

  res.status(201).json({
    success: true,
    card: {
      id:             card.id,
      nickname:       card.nickname,
      cardholderName: card.cardholderName,
      cardLast4:      card.cardLast4,
      cardMasked:     card.cardMasked,
      cardExpiry:     card.cardExpiry,
      createdAt:      card.createdAt
    }
  });
});

// DELETE saved card
app.delete('/api/account/cards/:cardId', requireAuth, (req, res) => {
  const user = req.user;
  const cardId = parseInt(req.params.cardId);

  if (!user.savedCards) {
    return res.status(404).json({ error: 'Card not found.' });
  }

  const idx = user.savedCards.findIndex(c => c.id === cardId);
  if (idx === -1) {
    return res.status(404).json({ error: 'Card not found.' });
  }

  user.savedCards.splice(idx, 1);
  res.json({ success: true });
});

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
initEmailTransport().then(() => {
  app.listen(PORT, () => {
    console.log(`Ticketyboo server running on http://localhost:${PORT}`);
  });
});
