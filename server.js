// server.js — Tim Eaton Fine Art E-commerce
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const path = require('path');
const db = require('./data/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust Render's reverse proxy so secure cookies work over HTTPS
app.set('trust proxy', 1);

// ─── SECURITY ──────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", "'unsafe-inline'",
        'https://js.stripe.com',
        'https://www.artworkarchive.com',
        'https://fonts.googleapis.com',
      ],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      mediaSrc: ["'self'", 'https://timeaton.thebeamhive.com'],
      frameSrc: ["'self'", 'https://js.stripe.com'],
      connectSrc: ["'self'", 'https://api.stripe.com'],
    }
  },
  crossOriginEmbedderPolicy: false,
}));

// ─── STRIPE WEBHOOK (raw body BEFORE json parser) ─────────────────────────
const checkoutRoutes = require('./routes/checkout');
app.use('/api/webhook', express.raw({ type: 'application/json' }), checkoutRoutes);

// ─── BODY PARSING ─────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── SESSION ──────────────────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' : false,
    maxAge: 24 * 60 * 60 * 1000,
  }
}));

// ─── STATIC FILES ─────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── API — ARTWORKS ───────────────────────────────────────────────────────
app.get('/api/artworks', (req, res) => {
  const { collection, available } = req.query;
  let artworks = db.getAllArtworks();
  if (collection) artworks = artworks.filter(a => a.collection === collection);
  if (available === 'true') artworks = artworks.filter(a => a.available && a.price);
  res.json(artworks);
});

app.get('/api/artworks/:id', (req, res) => {
  const artwork = db.getArtwork(req.params.id);
  if (!artwork) return res.status(404).json({ error: 'Not found' });
  res.json(artwork);
});

// ─── CHECKOUT & ADMIN ─────────────────────────────────────────────────────
app.use('/api/checkout', checkoutRoutes);
app.use('/checkout', checkoutRoutes);
app.use('/admin', require('./routes/admin'));

// ─── PAGE ROUTES ──────────────────────────────────────────────────────────
const { renderPage } = require('./views/renderer');

app.get('/', (req, res) => res.send(renderPage('home', db)));
app.get('/shop', (req, res) => res.send(renderPage('shop', db)));
app.get('/landscape-collection', (req, res) => res.send(renderPage('landscape', db)));
app.get('/contemporary-collection', (req, res) => res.send(renderPage('contemporary', db)));
app.get('/about', (req, res) => res.send(renderPage('about', db)));
app.get('/my-process', (req, res) => res.send(renderPage('process', db)));
app.get('/artwork/:id', (req, res) => {
  const artwork = db.getArtwork(req.params.id);
  if (!artwork) return res.redirect('/shop');
  res.send(renderPage('artwork', db, artwork));
});
app.get('/cart', (req, res) => res.send(renderPage('cart', db)));
app.get('/account', (req, res) => res.send(renderPage('account', db)));

// Guest order lookup — no accounts/passwords, just email + Stripe session id match
app.post('/account/track-order', (req, res) => {
  const { email, orderId } = req.body || {};
  if (!email || !orderId) return res.status(400).json({ error: 'Email and order confirmation number are required.' });
  const order = db.getOrder(orderId.trim());
  if (!order || (order.customerEmail || '').toLowerCase() !== email.trim().toLowerCase()) {
    return res.status(404).json({ error: 'No order found matching that email and confirmation number.' });
  }
  res.json({
    artworkTitle: order.artworkTitle,
    status: order.status === 'paid' ? 'Paid & confirmed' : order.status,
    amount: order.amount,
    createdAt: order.createdAt,
  });
});

// Legacy static paths
app.get('/index.html', (req, res) => res.redirect('/'));
app.get('/about-us.html', (req, res) => res.redirect('/about'));
app.get('/landscape-collection.html', (req, res) => res.redirect('/landscape-collection'));
app.get('/contemporary-collection.html', (req, res) => res.redirect('/contemporary-collection'));
app.get('/my-process.html', (req, res) => res.redirect('/my-process'));

// ─── START ────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║   Tim Eaton Fine Art — E-commerce Server     ║
║   Running at http://localhost:${PORT}           ║
║   Admin panel: http://localhost:${PORT}/admin   ║
╚══════════════════════════════════════════════╝
  `);

  // Auto-sync from Artwork Archive only if the database has no artworks yet
  // (first boot ever). On every later restart, existing data in data/timeaton.db
  // is reused as-is — no re-fetching. Use the Admin panel's "Scan for New
  // Artwork" button to check for updates instead.
  if (db.getAllArtworks().length === 0) {
    console.log('[Startup] Database is empty — running initial sync in background...');
    console.log('[Startup] This takes a few minutes. Site is live with no artworks in the meantime.\n');
    const { syncFromArtworkArchive } = require('./services/artworkArchive');
    syncFromArtworkArchive({ verbose: true })
      .then(artworks => {
        console.log(`\n[Startup] ✓ Initial sync complete — ${artworks.length} artworks loaded from Artwork Archive`);
      })
      .catch(err => {
        console.warn('\n[Startup] ✗ Auto-sync failed:', err.message);
        console.warn('[Startup] Run "npm run sync" manually, or use the Admin panel Sync button.');
      });
  } else {
    const lastSynced = db.getMeta('aa_last_synced_at');
    console.log(`[Startup] Database has ${db.getAllArtworks().length} artworks` +
      (lastSynced ? ` (last Artwork Archive sync: ${new Date(lastSynced).toLocaleString()})` : ' (no sync recorded yet)'));
  }
});

module.exports = app;
