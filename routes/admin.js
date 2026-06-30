// routes/admin.js — Admin panel: login, dashboard, artworks, orders
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../data/db');
const { requireAdmin } = require('../middleware/auth');

// ─── LOGIN ─────────────────────────────────────────────────────────────────

router.get('/login', (req, res) => {
  if (req.session?.isAdmin) return res.redirect('/admin');
  res.send(loginPage(req.query.error));
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'changeme';

  if (username !== adminUser) {
    return res.redirect('/admin/login?error=1');
  }

  // Direct compare (swap to bcrypt hash in production)
  const valid = password === adminPass;
  if (!valid) {
    return res.redirect('/admin/login?error=1');
  }

  req.session.isAdmin = true;
  req.session.adminUser = username;
  const returnTo = req.session.returnTo || '/admin';
  delete req.session.returnTo;
  res.redirect(returnTo);
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// ─── DASHBOARD ─────────────────────────────────────────────────────────────

router.get('/', requireAdmin, (req, res) => {
  const artworks = db.getAllArtworks();
  const orders = db.getAllOrders();
  const revenue = orders
    .filter(o => o.status === 'paid')
    .reduce((sum, o) => sum + parseFloat(o.amount || 0), 0);

  // Read last sync time from the database
  const lastSyncedAt = db.getMeta('aa_last_synced_at');
  const lastSyncedCount = db.getMeta('aa_last_synced_count');
  const lastSync = lastSyncedAt
    ? `${new Date(lastSyncedAt).toLocaleString()} (${lastSyncedCount || artworks.length} artworks)`
    : 'Never';

  res.send(adminShell('Dashboard', `
    <div class="sync-bar">
      <div>
        <strong>Artwork Archive Sync</strong>
        <span class="sync-meta">Last synced: ${lastSync}</span>
      </div>
      <div style="display:flex;gap:.5rem">
        <button class="admin-btn" id="sync-btn" data-mode="incremental">↻ Scan for New Artwork</button>
        <button class="admin-btn" id="resync-btn" data-mode="full" style="background:transparent;color:var(--a-accent);border:1px solid var(--a-accent)">Full Re-sync</button>
      </div>
    </div>
    <div id="sync-status" style="display:none;margin-bottom:1.5rem;padding:.75rem 1rem;border-radius:3px;font-size:.85rem"></div>

    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-num">${artworks.length}</div>
        <div class="stat-label">Total Artworks</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${artworks.filter(a => a.available).length}</div>
        <div class="stat-label">Available</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${orders.filter(o => o.status === 'paid').length}</div>
        <div class="stat-label">Orders Placed</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">$${revenue.toLocaleString('en-US', { minimumFractionDigits: 0 })}</div>
        <div class="stat-label">Revenue</div>
      </div>
    </div>

    <h2 class="section-title">Recent Orders</h2>
    <div class="table-wrap">
    <table>
      <thead><tr><th>Date</th><th>Artwork</th><th>Customer</th><th>Amount</th><th>Status</th></tr></thead>
      <tbody>
        ${orders.slice(0, 8).map(o => `
          <tr>
            <td>${new Date(o.createdAt).toLocaleDateString()}</td>
            <td>${o.artworkTitle || o.artworkId || '—'}</td>
            <td>${o.customerName || o.customerEmail || '—'}</td>
            <td>$${o.amount}</td>
            <td><span class="badge badge-${o.status}">${o.status}</span></td>
          </tr>`).join('') || '<tr><td colspan="5" style="color:#888;text-align:center;padding:2rem">No orders yet</td></tr>'}
      </tbody>
    </table>
    </div>
    <a href="/admin/orders" class="admin-link">View all orders →</a>
  `));
});

// ─── SYNC FROM ARTWORK ARCHIVE ─────────────────────────────────────────────

router.post('/sync', requireAdmin, async (req, res) => {
  try {
    const mode = req.body?.mode === 'full' ? 'full' : 'incremental';
    console.log(`\n[Admin] Sync triggered from dashboard (mode: ${mode})`);
    const { syncFromArtworkArchive } = require('../services/artworkArchive');
    const artworks = await syncFromArtworkArchive({ verbose: true, mode });
    const available = artworks.filter(a => a.available).length;
    res.json({ ok: true, total: artworks.length, available, sold: artworks.length - available, mode });
  } catch (err) {
    console.error('[admin/sync]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── ARTWORKS ──────────────────────────────────────────────────────────────

router.get('/artworks', requireAdmin, (req, res) => {
  const artworks = db.getAllArtworks();
  res.send(adminShell('Artworks', `
    <div class="page-actions">
      <h2 class="section-title">Artworks (${artworks.length})</h2>
      <a href="/admin/artworks/new" class="admin-btn">+ Add Artwork</a>
    </div>
    <div class="table-wrap">
    <table>
      <thead><tr><th>Image</th><th>Title</th><th>Collection</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        ${artworks.map(a => `
          <tr>
            <td><img src="${a.image}" style="width:60px;height:45px;object-fit:cover;border-radius:2px"></td>
            <td><strong>${a.title}</strong><br><small style="color:#888">${a.dims}</small></td>
            <td style="text-transform:capitalize">${a.collection}</td>
            <td>$${a.price?.toLocaleString()}</td>
            <td><span class="badge badge-${a.available ? 'available' : 'sold'}">${a.available ? 'Available' : 'Sold'}</span></td>
            <td>
              <a href="/admin/artworks/${a.id}/edit" class="admin-link">Edit</a> ·
              <form method="POST" action="/admin/artworks/${a.id}/toggle" style="display:inline">
                <button type="submit" class="admin-link-btn">${a.available ? 'Mark Sold' : 'Relist'}</button>
              </form> ·
              <form method="POST" action="/admin/artworks/${a.id}/delete" style="display:inline" class="confirm-delete" data-confirm="Delete ${a.title.replace(/"/g, '&quot;')}?">
                <button type="submit" class="admin-link-btn danger">Delete</button>
              </form>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>
    </div>
  `));
});

router.get('/artworks/new', requireAdmin, (req, res) => {
  res.send(adminShell('Add Artwork', artworkForm(null)));
});

router.get('/artworks/:id/edit', requireAdmin, (req, res) => {
  const artwork = db.getArtwork(req.params.id);
  if (!artwork) return res.redirect('/admin/artworks');
  res.send(adminShell('Edit Artwork', artworkForm(artwork)));
});

router.post('/artworks/new', requireAdmin, (req, res) => {
  const { title, collection, dims, edition, price, image, description, available } = req.body;
  db.createArtwork({
    title, collection, dims, edition,
    price: parseFloat(price) || 0,
    image, description,
    available: available === 'on' || available === 'true',
    stripeProductId: null, stripePriceId: null,
  });
  res.redirect('/admin/artworks');
});

router.post('/artworks/:id/edit', requireAdmin, (req, res) => {
  const { title, collection, dims, edition, price, image, description, available } = req.body;
  db.updateArtwork(req.params.id, {
    title, collection, dims, edition,
    price: parseFloat(price) || 0,
    image, description,
    available: available === 'on' || available === 'true',
  });
  res.redirect('/admin/artworks');
});

router.post('/artworks/:id/toggle', requireAdmin, (req, res) => {
  const artwork = db.getArtwork(req.params.id);
  if (artwork) db.updateArtwork(req.params.id, { available: !artwork.available });
  res.redirect('/admin/artworks');
});

router.post('/artworks/:id/delete', requireAdmin, (req, res) => {
  db.deleteArtwork(req.params.id);
  res.redirect('/admin/artworks');
});

// ─── ORDERS ────────────────────────────────────────────────────────────────

router.get('/orders', requireAdmin, (req, res) => {
  const orders = db.getAllOrders();
  const totalRev = orders.filter(o => o.status === 'paid').reduce((s, o) => s + parseFloat(o.amount || 0), 0);
  res.send(adminShell('Orders', `
    <h2 class="section-title">All Orders (${orders.length}) · Revenue: <span style="color:var(--a-accent)">$${totalRev.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></h2>
    <div class="table-wrap">
    <table>
      <thead><tr><th>Date</th><th>ID</th><th>Artwork</th><th>Customer</th><th>Email</th><th>Amount</th><th>Status</th></tr></thead>
      <tbody>
        ${orders.map(o => `
          <tr>
            <td>${new Date(o.createdAt).toLocaleDateString()}</td>
            <td style="font-size:.75rem;font-family:monospace;color:#888">${o.id?.slice(0, 20)}…</td>
            <td>${o.artworkTitle || o.artworkId || '—'}</td>
            <td>${o.customerName || '—'}</td>
            <td>${o.customerEmail || '—'}</td>
            <td>$${o.amount}</td>
            <td><span class="badge badge-${o.status}">${o.status}</span></td>
          </tr>`).join('') || '<tr><td colspan="7" style="color:#888;text-align:center;padding:2rem">No orders yet</td></tr>'}
      </tbody>
    </table>
    </div>
  `));
});

// ─── HTML BUILDERS ─────────────────────────────────────────────────────────

function loginPage(error) {
  return `<!doctype html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin Login — Tim Eaton</title>
<link rel="icon" href="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/logo3dmodel-1.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..700&family=Work+Sans:wght@300;400;500;600&display=swap">
${adminCSS()}
</head><body class="login-body">
<div class="login-box">
  <div class="login-brand">T.S. <span>Eaton</span></div>
  <p class="login-sub">Studio Admin</p>
  ${error ? '<p class="login-error">Incorrect credentials. Try again.</p>' : ''}
  <form method="POST" action="/admin/login" class="login-form">
    <input class="admin-field" type="text" name="username" placeholder="Username" required autocomplete="username">
    <input class="admin-field" type="password" name="password" placeholder="Password" required autocomplete="current-password">
    <button type="submit" class="admin-btn full">Sign In</button>
  </form>
</div>
</body></html>`;
}

function adminShell(title, content) {
  return `<!doctype html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Admin · Tim Eaton</title>
<link rel="icon" href="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/logo3dmodel-1.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..700&family=Work+Sans:wght@300;400;500;600;IBM+Plex+Mono:wght@400;500&display=swap">
${adminCSS()}
</head><body>
<div class="admin-layout">
  <aside class="sidebar">
    <div class="sidebar-brand">T.S. <span>Eaton</span><br><small>Studio Admin</small></div>
    <nav class="sidebar-nav">
      <a href="/admin">Dashboard</a>
      <a href="/admin/artworks">Artworks</a>
      <a href="/admin/orders">Orders</a>
      <a href="/" target="_blank">View Site ↗</a>
    </nav>
    <form method="POST" action="/admin/logout" class="sidebar-logout">
      <button type="submit" class="admin-link-btn">Sign Out</button>
    </form>
  </aside>
  <main class="admin-main">
    <div class="admin-topbar"><h1>${title}</h1></div>
    <div class="admin-content">${content}</div>
  </main>
</div>
<script>
function runSync(mode) {
  const btn = document.getElementById('sync-btn');
  const resyncBtn = document.getElementById('resync-btn');
  const status = document.getElementById('sync-status');
  if (!btn || !resyncBtn || !status) return;
  btn.disabled = true;
  resyncBtn.disabled = true;
  const activeBtn = mode === 'full' ? resyncBtn : btn;
  const origText = activeBtn.textContent;
  activeBtn.textContent = mode === 'full'
    ? '↻ Re-syncing everything... (~2-3 min)'
    : '↻ Scanning for new artwork...';
  status.style.display = 'block';
  status.style.background = '#FFF3CD';
  status.style.color = '#6b4c0a';
  status.textContent = mode === 'full'
    ? 'Re-fetching every artwork from Artwork Archive, including images. Please wait — do not close this tab...'
    : 'Checking Artwork Archive for new listings. Existing artworks are left untouched...';
  fetch('/admin/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) })
    .then(r => r.json())
    .then(data => {
      if (data.ok) {
        status.style.background = '#D4EDDA';
        status.style.color = '#1a5e2a';
        status.textContent = '✓ Sync complete! ' + data.total + ' artworks total (' + data.available + ' available, ' + data.sold + ' sold). Reload the page to see changes.';
      } else {
        throw new Error(data.error);
      }
    })
    .catch(err => {
      status.style.background = '#F8D7DA';
      status.style.color = '#721c24';
      status.textContent = '✗ Sync failed: ' + err.message;
    })
    .finally(() => {
      activeBtn.textContent = origText;
      btn.disabled = false;
      resyncBtn.disabled = false;
    });
}
document.getElementById('sync-btn')?.addEventListener('click', e => runSync(e.target.dataset.mode));
document.getElementById('resync-btn')?.addEventListener('click', e => runSync(e.target.dataset.mode));
document.querySelectorAll('form.confirm-delete').forEach(form => {
  form.addEventListener('submit', e => {
    if (!confirm(form.dataset.confirm || 'Are you sure?')) e.preventDefault();
  });
});
</script>
</body></html>`;
}

function artworkForm(artwork) {
  const v = artwork || {};
  return `
  <form method="POST" action="/admin/artworks/${artwork ? artwork.id + '/edit' : 'new'}" class="admin-form">
    <div class="form-grid">
      <div class="form-group">
        <label>Title</label>
        <input class="admin-field" name="title" value="${v.title || ''}" required>
      </div>
      <div class="form-group">
        <label>Collection</label>
        <select class="admin-field" name="collection">
          <option value="landscape" ${v.collection === 'landscape' ? 'selected' : ''}>Landscape</option>
          <option value="contemporary" ${v.collection === 'contemporary' ? 'selected' : ''}>Contemporary</option>
        </select>
      </div>
      <div class="form-group">
        <label>Price (USD)</label>
        <input class="admin-field" name="price" type="number" step="0.01" value="${v.price || ''}" required>
      </div>
      <div class="form-group">
        <label>Dimensions</label>
        <input class="admin-field" name="dims" value="${v.dims || ''}" placeholder="30 × 20 × 1.5 in">
      </div>
      <div class="form-group full">
        <label>Edition / Type</label>
        <input class="admin-field" name="edition" value="${v.edition || 'Limited edition digital print'}">
      </div>
      <div class="form-group full">
        <label>Image URL</label>
        <input class="admin-field" name="image" value="${v.image || ''}" placeholder="https://...">
      </div>
      <div class="form-group full">
        <label>Description</label>
        <textarea class="admin-field" name="description" rows="3">${v.description || ''}</textarea>
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" name="available" ${v.available !== false ? 'checked' : ''}> Available for purchase
        </label>
      </div>
    </div>
    <div class="form-actions">
      <button type="submit" class="admin-btn">${artwork ? 'Save Changes' : 'Add Artwork'}</button>
      <a href="/admin/artworks" class="admin-link">Cancel</a>
    </div>
  </form>`;
}

function adminCSS() {
  return `<style>
:root {
  --a-bg: #F5F4EF;
  --a-surface: #FFFFFF;
  --a-border: #E2E0D5;
  --a-text: #221F1A;
  --a-muted: #6B6760;
  --a-accent: #4F6F63;
  --a-accent-deep: #34493F;
  --a-danger: #9C3A2E;
  --a-sidebar: #1C1A17;
  --a-sidebar-text: #C9C5BA;
  --ff-display: 'Fraunces', serif;
  --ff-body: 'Work Sans', sans-serif;
}
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; font-family: var(--ff-body); background: var(--a-bg); color: var(--a-text); font-size: 14px; line-height: 1.6; }
a { color: var(--a-accent); text-decoration: none; }
h1, h2 { font-family: var(--ff-display); font-weight: 500; margin: 0; }

/* Layout */
.admin-layout { display: flex; min-height: 100vh; }
.sidebar { width: 220px; background: var(--a-sidebar); color: var(--a-sidebar-text); display: flex; flex-direction: column; padding: 0; flex-shrink: 0; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
.sidebar-brand { font-family: var(--ff-display); font-size: 1.3rem; color: #fff; padding: 1.5rem 1.5rem 0.5rem; line-height: 1.3; }
.sidebar-brand span { color: #9BBD9F; }
.sidebar-brand small { font-family: var(--ff-body); font-size: .7rem; color: #666; letter-spacing:.08em; text-transform:uppercase; }
.sidebar-nav { display: flex; flex-direction: column; padding: 1rem 0; margin-top: .5rem; gap: 2px; flex: 1; }
.sidebar-nav a { color: var(--a-sidebar-text); padding: .6rem 1.5rem; font-size: .85rem; transition: background .15s, color .15s; border-left: 3px solid transparent; }
.sidebar-nav a:hover { background: rgba(255,255,255,.05); color: #fff; border-left-color: var(--a-accent); }
.sidebar-logout { padding: 1rem 1.5rem; }
.admin-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.admin-topbar { padding: 1.5rem 2rem 0; border-bottom: 1px solid var(--a-border); background: var(--a-surface); }
.admin-topbar h1 { font-size: 1.5rem; padding-bottom: 1rem; }
.admin-content { padding: 2rem; overflow-x: auto; }

/* Stats */
.stat-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
.stat-card { background: var(--a-surface); border: 1px solid var(--a-border); border-radius: 4px; padding: 1.25rem 1.5rem; }
.stat-num { font-family: var(--ff-display); font-size: 2rem; font-weight: 300; color: var(--a-accent); }
.stat-label { font-size: .8rem; color: var(--a-muted); text-transform: uppercase; letter-spacing: .06em; margin-top: .25rem; }

/* Tables */
.table-wrap { overflow-x: auto; background: var(--a-surface); border: 1px solid var(--a-border); border-radius: 4px; }
table { width: 100%; border-collapse: collapse; }
th { background: var(--a-bg); color: var(--a-muted); text-align: left; padding: .75rem 1rem; font-size: .75rem; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid var(--a-border); font-weight: 500; white-space: nowrap; }
td { padding: .75rem 1rem; border-bottom: 1px solid var(--a-border); vertical-align: middle; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: var(--a-bg); }

/* Badges */
.badge { display: inline-block; padding: .2rem .6rem; border-radius: 20px; font-size: .72rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; }
.badge-paid, .badge-available { background: #D4EDDA; color: #1a5e2a; }
.badge-pending { background: #FFF3CD; color: #6b4c0a; }
.badge-sold { background: #F8D7DA; color: #721c24; }
.badge-failed { background: #F8D7DA; color: #721c24; }

/* Forms */
.admin-form { max-width: 800px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
.form-group { display: flex; flex-direction: column; gap: .4rem; }
.form-group.full { grid-column: 1 / -1; }
.form-group label { font-size: .8rem; font-weight: 600; color: var(--a-muted); text-transform: uppercase; letter-spacing: .06em; }
.admin-field { font-family: var(--ff-body); font-size: .9rem; padding: .6rem .8rem; border: 1px solid var(--a-border); border-radius: 3px; background: var(--a-surface); color: var(--a-text); width: 100%; transition: border-color .15s; }
.admin-field:focus { outline: none; border-color: var(--a-accent); }
textarea.admin-field { resize: vertical; }
select.admin-field { appearance: none; cursor: pointer; }
.checkbox-label { display: flex; align-items: center; gap: .5rem; font-size: .9rem; font-weight: 400; text-transform: none; letter-spacing: 0; color: var(--a-text); cursor: pointer; }
.form-actions { margin-top: 1.5rem; display: flex; align-items: center; gap: 1rem; }

/* Buttons & Links */
.admin-btn { display: inline-flex; align-items: center; gap: .5rem; padding: .6rem 1.25rem; background: var(--a-accent); color: #fff; border: none; border-radius: 3px; font-size: .85rem; font-weight: 500; cursor: pointer; text-decoration: none; transition: background .15s; font-family: var(--ff-body); }
.admin-btn:hover { background: var(--a-accent-deep); }
.admin-btn.full { width: 100%; justify-content: center; padding: .8rem; font-size: 1rem; }
.admin-link { color: var(--a-accent); font-size: .85rem; }
.admin-link-btn { background: none; border: none; color: var(--a-accent); cursor: pointer; font-size: .85rem; font-family: inherit; padding: 0; }
.admin-link-btn.danger { color: var(--a-danger); }
.page-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }
.section-title { font-size: 1.1rem; margin-bottom: 1rem; font-family: var(--ff-display); }

/* Login */
/* Sync bar */
.sync-bar { display:flex; align-items:center; justify-content:space-between; background:var(--a-surface); border:1px solid var(--a-border); border-radius:4px; padding:1rem 1.25rem; margin-bottom:1.5rem; gap:1rem; flex-wrap:wrap; }
.sync-meta { display:block; font-size:.78rem; color:var(--a-muted); margin-top:.2rem; font-family:'IBM Plex Mono',monospace; }

.login-body { background: var(--a-sidebar); display: flex; align-items: center; justify-content: center; min-height: 100vh; }
.login-box { background: var(--a-surface); padding: 2.5rem; border-radius: 6px; width: 360px; max-width: 90vw; }
.login-brand { font-family: var(--ff-display); font-size: 2rem; font-weight: 300; margin-bottom: .25rem; }
.login-brand span { color: var(--a-accent); }
.login-sub { color: var(--a-muted); font-size: .8rem; text-transform: uppercase; letter-spacing: .1em; margin: 0 0 1.5rem; }
.login-form { display: flex; flex-direction: column; gap: 1rem; }
.login-error { color: var(--a-danger); font-size: .85rem; background: #fde8e6; padding: .5rem .75rem; border-radius: 3px; margin: 0 0 .5rem; }
</style>`;
}

module.exports = router;
