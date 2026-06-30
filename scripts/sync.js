#!/usr/bin/env node
// scripts/sync.js — Run this to pull all artworks from Artwork Archive
// Usage:  node scripts/sync.js
// Or add to package.json scripts: "sync": "node scripts/sync.js"

require('dotenv').config();
const { syncFromArtworkArchive } = require('../services/artworkArchive');

console.log('╔══════════════════════════════════════════════╗');
console.log('║   Artwork Archive → Tim Eaton Site Sync      ║');
console.log('╚══════════════════════════════════════════════╝');
console.log('This will fetch ALL artworks from artworkarchive.com/profile/tim-eaton');
console.log('and save them to the database (data/timeaton.db)\n');

syncFromArtworkArchive({ verbose: true })
  .then(artworks => {
    const available = artworks.filter(a => a.available).length;
    const sold = artworks.filter(a => !a.available).length;
    console.log('\n✓ Sync complete!');
    console.log(`  Total: ${artworks.length} artworks`);
    console.log(`  Available: ${available}`);
    console.log(`  Sold: ${sold}`);
    console.log('\nStart your server now: node server.js');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n✗ Sync failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  });
