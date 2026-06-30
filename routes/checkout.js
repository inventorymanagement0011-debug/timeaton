// routes/checkout.js — Stripe Checkout Session creation & webhooks
const express = require('express');
const router = express.Router();
const db = require('../data/db');

let stripe;
function getStripe() {
  if (!stripe) stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  return stripe;
}

// POST /api/checkout/session — create a Stripe Checkout session for one or
// more artworks (cart). Accepts either { artworkIds: [...] } for a multi-item
// cart, or the legacy { artworkId } for a single piece — both produce one
// Stripe session with one line item per artwork (qty capped at 1 each since
// these are unique, one-of-a-kind originals).
router.post('/session', async (req, res) => {
  try {
    const ids = Array.isArray(req.body.artworkIds) && req.body.artworkIds.length
      ? req.body.artworkIds
      : (req.body.artworkId ? [req.body.artworkId] : []);
    if (!ids.length) return res.status(400).json({ error: 'artworkIds is required' });

    const artworks = ids.map(id => db.getArtwork(id)).filter(Boolean);
    if (!artworks.length) return res.status(404).json({ error: 'No matching artworks found' });
    const unavailable = artworks.find(a => !a.available);
    if (unavailable) return res.status(400).json({ error: `"${unavailable.title}" is no longer available` });

    const s = getStripe();
    const SITE = process.env.SITE_URL || 'http://localhost:3000';

    const session = await s.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: artworks.map(artwork => ({
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(artwork.price * 100), // cents
          product_data: {
            name: artwork.title,
            description: [artwork.dims, artwork.edition].filter(Boolean).join(' · '),
            images: artwork.image ? [artwork.image] : [],
            metadata: { artworkId: artwork.id }
          },
        },
        quantity: 1, // fine art: one of each, always
      })),
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'DE', 'FR', 'AU', 'NL', 'IT', 'ES', 'CH'],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 0, currency: 'usd' },
            display_name: 'Standard shipping',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 7 },
              maximum: { unit: 'business_day', value: 14 },
            },
          },
        },
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 5000, currency: 'usd' }, // $50 express
            display_name: 'Express shipping',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 3 },
              maximum: { unit: 'business_day', value: 5 },
            },
          },
        },
      ],
      metadata: {
        artworkIds: JSON.stringify(artworks.map(a => a.id)),
        artworkTitles: artworks.map(a => a.title).join(', '),
      },
      success_url: `${SITE}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE}/cart`,
      custom_text: {
        submit: {
          message: 'Your piece will be carefully packaged and insured for transit.'
        }
      }
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[checkout/session]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Mark every artwork in a completed session as sold + record one order.
function fulfillSession(session) {
  let artworkIds = [];
  try { artworkIds = JSON.parse(session.metadata?.artworkIds || '[]'); } catch {}
  if (!artworkIds.length && session.metadata?.artworkId) artworkIds = [session.metadata.artworkId]; // legacy

  if (!db.getOrder(session.id)) {
    db.createOrder({
      id: session.id,
      customerEmail: session.customer_details?.email,
      customerName: session.customer_details?.name,
      artworkTitle: session.metadata?.artworkTitles || session.metadata?.artworkTitle,
      artworkId: artworkIds.join(', '),
      amount: (session.amount_total / 100).toFixed(2),
      shipping: session.shipping_details?.address || null,
      paymentStatus: session.payment_status,
      status: session.payment_status === 'paid' ? 'paid' : 'pending',
      stripeSessionId: session.id,
      stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
    });
  } else if (session.payment_status === 'paid') {
    db.updateOrder(session.id, { status: 'paid', paymentStatus: 'paid' });
  }

  if (session.payment_status === 'paid') {
    artworkIds.forEach(id => db.updateArtwork(id, { available: false }));
  }
  return artworkIds;
}

// GET /checkout/success — thank-you page handler
router.get('/success', async (req, res) => {
  const { session_id } = req.query;
  let order = null;

  if (session_id) {
    try {
      const s = getStripe();
      const session = await s.checkout.sessions.retrieve(session_id, {
        expand: ['line_items', 'shipping_details', 'payment_intent']
      });

      fulfillSession(session);
      const saved = db.getOrder(session_id);

      order = {
        customerEmail: saved?.customerEmail,
        customerName: saved?.customerName,
        artworkTitle: saved?.artworkTitle,
        amount: saved?.amount,
        paymentStatus: session.payment_status,
        sessionId: session_id,
      };
    } catch (e) {
      console.error('[checkout/success]', e.message);
    }
  }

  res.send(buildSuccessPage(order));
});

// POST /api/webhook — Stripe webhook (for reliable event handling in production)
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    const s = getStripe();
    event = s.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const artworkIds = fulfillSession(session);
      console.log(`[webhook] Order confirmed: ${session.id} — ${artworkIds.join(', ')}`);
      break;
    }
    case 'payment_intent.payment_failed': {
      const pi = event.data.object;
      console.warn('[webhook] Payment failed:', pi.id);
      break;
    }
  }

  res.json({ received: true });
});

// ---- helpers ----
function buildSuccessPage(order) {
  return `<!doctype html><html lang="en-US"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Order Confirmed — Tim Eaton</title>
<link rel="icon" href="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/logo3dmodel-1.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,700;1,300;1,400&family=Roboto:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/theme.css">
<style>
  .success-wrap { max-width: 600px; margin: 140px auto 80px; padding: 0 24px; text-align:center; }
  .success-icon { font-size: 3rem; margin-bottom: 1.5rem; color:#20699C; }
  .success-wrap h1 { font-family:'Merriweather',serif; font-size: clamp(1.8rem,4vw,2.6rem); font-weight:700; margin-bottom: 1rem; color:#111; }
  .success-wrap > p { font-family:'Roboto',sans-serif; color:#666; }
  .order-details { background: #fff; border-radius:12px; padding:1.5rem 2rem; margin:2rem 0; text-align:left; }
  .order-row { display:flex; justify-content:space-between; padding:.6rem 0; border-bottom:1px solid #eee; font-size:.9rem; font-family:'Roboto',sans-serif; }
  .order-row:last-child { border:none; font-weight:600; }
  .patina { color: #20699C; }
</style>
</head><body style="background:#CCCCCC">
<header id="hdr-trnsprent" class="site-header">
  <div id="inr-trnsprent" class="header-inner">
    <div id="logo-bck" class="header-logo">
      <a href="/"><img src="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/Group-1261153202.png" alt="T.S. Eaton Fine Art" width="176" height="138"/></a>
    </div>
  </div>
</header>
<main>
  <div class="success-wrap">
    <div class="success-icon">&#10003;</div>
    <h1>Thank you${order?.customerName ? `, ${order.customerName.split(' ')[0]}` : ''}.</h1>
    <p>Your piece is on its way to finding its permanent home. We'll be in touch shortly with shipping details.</p>
    ${order ? `
    <div class="order-details">
      <div class="order-row"><span>Artwork</span><span class="patina">${order.artworkTitle || '—'}</span></div>
      <div class="order-row"><span>Email</span><span>${order.customerEmail || '—'}</span></div>
      <div class="order-row"><span>Payment</span><span style="color:#4F6F63">&#10003; Confirmed</span></div>
      <div class="order-row"><span>Total</span><span>$${order.amount}</span></div>
      <div class="order-row"><span>Confirmation #</span><span style="font-size:.75rem">${order.sessionId}</span></div>
    </div>` : '<p style="margin-top:2rem">Order details will be sent to your email.</p>'}
    <p style="color:#888;font-size:.85rem;margin:2rem 0 1.5rem;font-family:'Roboto',sans-serif">Questions? <a href="mailto:timeatonart@gmail.com" style="color:#20699C">timeatonart@gmail.com</a> &middot; <a href="tel:+19149066345" style="color:#20699C">+1 (914) 906 6345</a></p>
    <a class="btn-primary" href="/">Return Home</a>
  </div>
</main>
</body></html>`;
}

module.exports = router;
