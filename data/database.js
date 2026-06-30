// data/database.js — SQLite connection + schema
// Replaces the old flat-file JSON store (data/store.json) so artwork and
// order records survive server restarts/redeploys without re-fetching from
// Artwork Archive every time.
//
// IMPORTANT (production deploys): SQLite is a single file on disk
// (data/timeaton.db by default, override with DB_PATH in .env). On hosting
// platforms with an EPHEMERAL filesystem (e.g. most free/default tiers on
// Render, Railway, Heroku), anything written to disk is wiped on every
// redeploy or container restart — that includes this database file. If your
// data keeps disappearing after a deploy, you need to either:
//   1. Mount a persistent volume/disk and point DB_PATH at a file inside it, or
//   2. Migrate to a hosted Postgres/MySQL instance instead.
// On a normal VPS or any host with a persistent disk, this just works.
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'timeaton.db');

// Ensure the directory exists (matters if DB_PATH points outside data/)
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS artworks (
    id               TEXT PRIMARY KEY,
    title            TEXT NOT NULL,
    medium           TEXT,
    dims             TEXT,
    edition          TEXT,
    price            REAL,
    available        INTEGER NOT NULL DEFAULT 1,
    image            TEXT,
    collection       TEXT,
    description      TEXT,
    aaSlug           TEXT,
    stripeProductId  TEXT,
    stripePriceId    TEXT,
    updatedFromAA    TEXT,
    createdAt        TEXT NOT NULL,
    updatedAt        TEXT
  );

  CREATE TABLE IF NOT EXISTS orders (
    id                     TEXT PRIMARY KEY,
    customerEmail          TEXT,
    customerName           TEXT,
    artworkTitle           TEXT,
    artworkId              TEXT,
    amount                 TEXT,
    shipping               TEXT,
    paymentStatus          TEXT,
    status                 TEXT NOT NULL DEFAULT 'pending',
    stripeSessionId        TEXT,
    stripePaymentIntentId  TEXT,
    createdAt              TEXT NOT NULL,
    updatedAt              TEXT
  );

  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_artworks_collection ON artworks(collection);
  CREATE INDEX IF NOT EXISTS idx_artworks_aaSlug ON artworks(aaSlug);
  CREATE INDEX IF NOT EXISTS idx_orders_createdAt ON orders(createdAt);
`);

module.exports = db;
