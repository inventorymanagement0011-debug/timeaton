// data/db.js — Data access layer, backed by SQLite (data/database.js)
const db = require('./database');

function rowToArtwork(row) {
  if (!row) return null;
  return { ...row, available: !!row.available, shipping: undefined };
}

function rowToOrder(row) {
  if (!row) return null;
  return { ...row, shipping: row.shipping ? JSON.parse(row.shipping) : null };
}

// ---- ARTWORKS ----
function getAllArtworks() {
  return db.prepare('SELECT * FROM artworks ORDER BY title ASC').all().map(rowToArtwork);
}

function getArtwork(id) {
  const row = db.prepare('SELECT * FROM artworks WHERE id = ? OR aaSlug = ?').get(id, id);
  return rowToArtwork(row);
}

function getArtworksByCollection(collection) {
  return db.prepare('SELECT * FROM artworks WHERE collection = ?').all(collection).map(rowToArtwork);
}

function getAvailableArtworks() {
  return db.prepare('SELECT * FROM artworks WHERE available = 1 AND price IS NOT NULL').all().map(rowToArtwork);
}

const ARTWORK_COLUMNS = [
  'id', 'title', 'medium', 'dims', 'edition', 'price', 'available', 'image',
  'collection', 'description', 'aaSlug', 'stripeProductId', 'stripePriceId', 'updatedFromAA',
];

function createArtwork(artwork) {
  artwork.id = artwork.id || artwork.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  artwork.createdAt = new Date().toISOString();
  const cols = ['id', 'createdAt', ...ARTWORK_COLUMNS.filter(c => c !== 'id')];
  const placeholders = cols.map(c => `@${c}`).join(', ');
  const values = {};
  cols.forEach(c => { values[c] = artwork[c] !== undefined ? (c === 'available' ? (artwork[c] ? 1 : 0) : artwork[c]) : null; });
  db.prepare(`INSERT INTO artworks (${cols.join(', ')}) VALUES (${placeholders})`).run(values);
  return getArtwork(artwork.id);
}

function updateArtwork(id, updates) {
  const existing = getArtwork(id);
  if (!existing) return null;
  const updatedAt = new Date().toISOString();
  const fields = Object.keys(updates).filter(k => ARTWORK_COLUMNS.includes(k) || k === 'updatedAt');
  if (!fields.length) return existing;
  const setClause = fields.map(f => `${f} = @${f}`).join(', ') + ', updatedAt = @updatedAt';
  const values = { updatedAt };
  fields.forEach(f => { values[f] = f === 'available' ? (updates[f] ? 1 : 0) : updates[f]; });
  db.prepare(`UPDATE artworks SET ${setClause} WHERE id = @id`).run({ ...values, id: existing.id });
  return getArtwork(existing.id);
}

function deleteArtwork(id) {
  const res = db.prepare('DELETE FROM artworks WHERE id = ?').run(id);
  return res.changes > 0;
}

function upsertArtworksFromAA(artworks) {
  const insert = db.prepare(`
    INSERT INTO artworks (id, title, medium, dims, price, available, image, collection, description, aaSlug, stripeProductId, stripePriceId, updatedFromAA, createdAt)
    VALUES (@id, @title, @medium, @dims, @price, @available, @image, @collection, @description, @aaSlug, @stripeProductId, @stripePriceId, @updatedFromAA, @createdAt)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      medium = COALESCE(excluded.medium, artworks.medium),
      dims = COALESCE(excluded.dims, artworks.dims),
      price = excluded.price,
      available = excluded.available,
      image = COALESCE(excluded.image, artworks.image),
      collection = COALESCE(artworks.collection, excluded.collection),
      description = COALESCE(artworks.description, excluded.description),
      aaSlug = excluded.aaSlug,
      updatedFromAA = excluded.updatedFromAA
  `);
  const tx = db.transaction(rows => {
    for (const a of rows) {
      insert.run({
        id: a.id, title: a.title, medium: a.medium || null, dims: a.dims || null,
        price: a.price, available: a.available ? 1 : 0, image: a.image || null,
        collection: a.collection || null, description: a.description || '',
        aaSlug: a.aaSlug || a.id, stripeProductId: a.stripeProductId || null,
        stripePriceId: a.stripePriceId || null, updatedFromAA: a.updatedFromAA || new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    }
  });
  tx(artworks);
}

// ---- ORDERS ----
function getAllOrders() {
  return db.prepare('SELECT * FROM orders ORDER BY createdAt DESC').all().map(rowToOrder);
}

function getOrder(id) {
  return rowToOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(id));
}

function createOrder(order) {
  order.id = order.id || `ORD-${Date.now()}`;
  order.createdAt = new Date().toISOString();
  order.status = order.status || 'pending';
  db.prepare(`
    INSERT INTO orders (id, customerEmail, customerName, artworkTitle, artworkId, amount, shipping, paymentStatus, status, stripeSessionId, stripePaymentIntentId, createdAt)
    VALUES (@id, @customerEmail, @customerName, @artworkTitle, @artworkId, @amount, @shipping, @paymentStatus, @status, @stripeSessionId, @stripePaymentIntentId, @createdAt)
  `).run({
    id: order.id,
    customerEmail: order.customerEmail || null,
    customerName: order.customerName || null,
    artworkTitle: order.artworkTitle || null,
    artworkId: order.artworkId || null,
    amount: order.amount != null ? String(order.amount) : null,
    shipping: order.shipping ? JSON.stringify(order.shipping) : null,
    paymentStatus: order.paymentStatus || null,
    status: order.status,
    stripeSessionId: order.stripeSessionId || null,
    stripePaymentIntentId: order.stripePaymentIntentId || null,
    createdAt: order.createdAt,
  });
  return getOrder(order.id);
}

function updateOrder(id, updates) {
  const existing = getOrder(id);
  if (!existing) return null;
  const updatedAt = new Date().toISOString();
  const allowed = ['customerEmail', 'customerName', 'artworkTitle', 'artworkId', 'amount', 'paymentStatus', 'status', 'stripeSessionId', 'stripePaymentIntentId'];
  const fields = Object.keys(updates).filter(k => allowed.includes(k));
  if (!fields.length) return existing;
  const setClause = fields.map(f => `${f} = @${f}`).join(', ') + ', updatedAt = @updatedAt';
  const values = { updatedAt, id };
  fields.forEach(f => { values[f] = updates[f]; });
  db.prepare(`UPDATE orders SET ${setClause} WHERE id = @id`).run(values);
  return getOrder(id);
}

// ---- META (sync bookkeeping) ----
function getMeta(key) {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setMeta(key, value) {
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

module.exports = {
  getAllArtworks, getArtwork, getArtworksByCollection, getAvailableArtworks,
  createArtwork, updateArtwork, deleteArtwork, upsertArtworksFromAA,
  getAllOrders, getOrder, createOrder, updateOrder,
  getMeta, setMeta,
};
