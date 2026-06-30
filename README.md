# Tim Eaton Fine Art — Dynamic E-commerce Site

A full Node.js/Express conversion of the static portfolio site, with:

- **Stripe Checkout** — secure, hosted payment pages (no card data touches your server)
- **Cart system** — drawer cart with localStorage persistence
- **Admin panel** — manage artworks, track orders, toggle availability
- **Artwork Archive integration** — feed still embedded; all purchases happen on THIS site
- **Same design** — identical to the static version (Fraunces + Work Sans, gallery palette)

---

## Quick Start

### 1. Install dependencies

```bash
cd timeaton-ecommerce
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Then edit .env with your real values
```

Required:
- `STRIPE_SECRET_KEY` — from [Stripe Dashboard → API Keys](https://dashboard.stripe.com/apikeys)
- `STRIPE_PUBLISHABLE_KEY` — same page
- `SESSION_SECRET` — any long random string
- `ADMIN_USERNAME` + `ADMIN_PASSWORD` — your admin login

### 3. Run the server

```bash
npm start
# or for development with auto-reload:
npm run dev   # (requires: npm install -D nodemon)
```

Visit:
- Site: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`

---

## Stripe Setup

### Test mode (development)

Use test keys (`sk_test_...` / `pk_test_...`) from Stripe Dashboard.

Test cards:
- ✅ Success: `4242 4242 4242 4242` · any future date · any CVC
- ❌ Decline: `4000 0000 0000 0002`

### Webhooks (production)

Stripe webhooks ensure order records are created even if the user closes the browser before the success page loads.

```bash
# Install Stripe CLI
stripe listen --forward-to localhost:3000/api/webhook

# Copy the webhook signing secret to .env as STRIPE_WEBHOOK_SECRET
```

In production: create a webhook endpoint at `https://yourdomain.com/api/webhook` in the Stripe Dashboard pointing to `checkout.session.completed`.

---

## Admin Panel

**URL:** `/admin` (redirects to `/admin/login`)

**Default credentials:** set via `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env`

### Features

| Page | What you can do |
|---|---|
| Dashboard | Revenue, order count, recent orders |
| Artworks | Add / edit / delete / mark sold artworks |
| Orders | View all orders, customer details, payment status |

### Adding a new artwork

1. Go to `/admin/artworks`
2. Click **+ Add Artwork**
3. Fill in title, collection, price, image URL, description
4. Save — it appears on the site immediately

---

## How checkout works

```
User clicks "Add to Cart"
  → Cart drawer opens (localStorage)
  → User clicks "Proceed to Checkout"
  → POST /api/checkout/session
  → Server creates Stripe Checkout Session
  → User redirected to Stripe's hosted page
  → User pays
  → Stripe redirects to /checkout/success?session_id=...
  → Order saved to data/store.json
  → Artwork marked as sold
```

**No card data ever touches your server.** Everything sensitive goes through Stripe.

---

## Artwork Archive Integration

The homepage still embeds the Artwork Archive live feed widget. However, the "acquire" links in that widget still go to Artwork Archive's own site (this is a limitation of their embed — we cannot intercept those clicks).

**Workaround:** The artworks that matter for purchasing are managed in the Admin panel (`data/store.json`). Keep them in sync with your Artwork Archive profile. The live feed is informational / discovery; buying happens in the cart above.

---

## Deploying to Production

### Recommended: Railway / Render / Fly.io

```bash
# Railway (easiest)
npm install -g @railway/cli
railway login
railway new
railway up
railway variables set STRIPE_SECRET_KEY=sk_live_... # etc
```

### Environment variables to set in production

```
NODE_ENV=production
PORT=3000  (usually set automatically)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SESSION_SECRET=<long random string>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<secure password>
SITE_URL=https://yourdomain.com
```

### Upgrading the data store

`data/store.json` is a flat JSON file — fine for low volume. For higher traffic or multiple servers, swap `data/db.js` for a PostgreSQL adapter (pg / Prisma) without changing anything else.

---

## File Structure

```
timeaton-ecommerce/
├── server.js              Entry point
├── data/
│   ├── db.js              Data access layer (swap for real DB)
│   └── store.json         Artworks + orders (auto-created)
├── routes/
│   ├── checkout.js        Stripe session + webhook + success page
│   └── admin.js           Admin panel (login, CRUD, orders)
├── views/
│   └── renderer.js        Server-side HTML generation
├── middleware/
│   └── auth.js            Admin session guard
├── public/
│   ├── css/
│   │   ├── styles.css     Original design (unchanged)
│   │   └── shop.css       Cart drawer + buy buttons + detail page
│   └── js/
│       ├── script.js      Original nav/video/FAQ/forms JS
│       └── shop.js        Cart state, Stripe redirect, filters
└── .env.example           Copy to .env and fill in
```
