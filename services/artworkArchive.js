// services/artworkArchive.js
// Fetches Tim Eaton's artworks from Artwork Archive public embed pages.
//
// IMPORTANT: artworkarchive.com sits behind Cloudflare bot management, which
// fingerprints the TLS/HTTP client, not just headers. Plain Node `fetch` /
// `node-fetch` gets a 403 even with full browser headers — only clients with
// a browser-like TLS handshake get through. `got-scraping` (Apify) ships a
// browser-matching TLS/HTTP2 fingerprint and is what actually works here.
const { parse } = require('node-html-parser');
const db = require('../data/db');

const BASE    = 'https://www.artworkarchive.com';
const PROFILE = 'tim-eaton';

const REQUEST_TIMEOUT_MS = 20000;
const MAX_RETRIES = 4;
// Cloudflare enforces a per-IP request-rate window on this site (confirmed via
// repeated testing: a sustained ~250-request sync starts returning 429 around
// request #210). A 429 means "back off hard", not "retry fast" — hammering it
// only extends the window. These knobs are deliberately conservative.
const ITEM_DELAY_MS = 900;
const RATE_LIMIT_COOLDOWN_MS = 20000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// got-scraping is ESM-only; load it once via dynamic import from this CJS module.
let _gotScrapingPromise = null;
function getGotScraping() {
  if (!_gotScrapingPromise) {
    _gotScrapingPromise = import('got-scraping').then(m => m.gotScraping);
  }
  return _gotScrapingPromise;
}

async function fetchHtml(url, attempt = 1) {
  try {
    const gotScraping = await getGotScraping();
    const res = await gotScraping(url, {
      timeout: { request: REQUEST_TIMEOUT_MS },
      retry: { limit: 0 }, // we handle retries ourselves so we can log/backoff
    });
    if (res.statusCode === 429) {
      const err = new Error(`HTTP 429 — ${url}`);
      err.statusCode = 429;
      err.retryAfter = parseInt(res.headers['retry-after'], 10) || null;
      throw err;
    }
    if (res.statusCode !== 200) throw new Error(`HTTP ${res.statusCode} — ${url}`);
    return res.body;
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      const isRateLimit = err.statusCode === 429;
      const backoff = isRateLimit
        ? (err.retryAfter ? err.retryAfter * 1000 : RATE_LIMIT_COOLDOWN_MS * attempt)
        : 1000 * attempt * 2;
      console.warn(`[AA Sync] ${isRateLimit ? 'Rate limited' : 'Request failed'} (attempt ${attempt}/${MAX_RETRIES}), backing off ${Math.round(backoff / 1000)}s — ${url}`);
      await sleep(backoff);
      return fetchHtml(url, attempt + 1);
    }
    throw new Error(`${err.message} (after ${MAX_RETRIES} attempts) — ${url}`);
  }
}

// ─── PARSE LISTING PAGE ────────────────────────────────────────────────────
// Each artwork link text looks like:
// "Evening Retreat by Tim Eaton, Image 1. Evening Retreat oil on canvas 16 x 36 x 1.5 in $3,000"
// We strip everything up to "Image N. " to avoid title duplication.

function parseListingPage(html) {
  const root = parse(html);
  const artworks = [];
  const seen = new Set();

  root.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href') || '';
    const m = href.match(/\/profile\/tim-eaton\/artwork\/([^\/]+)\/embed$/);
    if (!m) return;
    const slug = m[1];
    if (seen.has(slug)) return;
    seen.add(slug);

    // Strip "Artwork by Artist, Image N." prefix
    let text = a.text.replace(/^.*Image \d+\.\s*/i, '').replace(/\s+/g, ' ').trim();

    // Must have dimensions to be a full listing entry (not a thumbnail)
    const dimsMatch = text.match(/(\d+\s*x\s*\d+(?:\s*x\s*[\d.]+)?\s*in)/i);
    if (!dimsMatch) return;

    const dims    = dimsMatch[1].trim();
    const dimsIdx = text.indexOf(dims);
    const before  = text.slice(0, dimsIdx).trim();
    const after   = text.slice(dimsIdx + dims.length).trim();

    // Price / sold
    const priceMatch = after.match(/\$[\d,]+/);
    const price     = priceMatch ? parseFloat(priceMatch[0].replace(/[$,]/g, '')) : null;
    const available = !after.includes('Sold');

    // Medium sits between title and dims
    const medPat  = /\s+(oil on canvas|acrylic[\w\s]*on canvas|mixed media?[\w\s]*on canvas|mixed medium on canvas|Mixed Media.*|watercolor[\w\s]*)/i;
    const medMatch = before.match(medPat);
    const title   = (medMatch ? before.slice(0, medMatch.index) : before).trim() ||
                    slug.replace(/-tim-eaton(-\d+)?$/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const medium  = medMatch ? medMatch[1].trim() : null;

    artworks.push({ slug, title, medium, dims, price, available, image: null });
  });

  return artworks;
}

function parseTotalPages(html) {
  const root = parse(html);
  let max = 1;
  root.querySelectorAll('a[href]').forEach(a => {
    const m = (a.getAttribute('href') || '').match(/[?&]page=(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1]));
  });
  return max;
}

// ─── PARSE DETAIL PAGE — get high-res image ────────────────────────────────
function parseDetailPage(html) {
  const root = parse(html);
  let image = null;

  // Prefer the "View full" link: https://assets.artworkarchive.com/.../t_jpg_profile_2000/...
  root.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (!image && href.includes('assets.artworkarchive.com') && href.includes('t_jpg_profile_2000')) {
      image = href;
    }
  });

  // Fallback: any artworkarchive assets img, upgrade to large size
  if (!image) {
    root.querySelectorAll('img[src]').forEach(img => {
      const src = img.getAttribute('src') || '';
      if (!image && src.includes('assets.artworkarchive.com') && !src.includes('aa_square-logo')) {
        image = src.replace(/\/t_jpg_[a-z_0-9]+\//, '/t_jpg_profile_2000/').replace(/\.jpg$/, '');
      }
    });
  }

  return { image };
}

function inferCollection(artwork) {
  const med = (artwork.medium || '').toLowerCase();
  if (['mixed media', 'mixed medium', 'iron oxide', 'copper', 'bronze', 'cardboard'].some(k => med.includes(k))) {
    return 'contemporary';
  }
  return 'landscape';
}

// ─── LISTING SCAN — cheap, always fetches all listing pages ───────────────
// This is the "scan" step: it tells us every slug currently live on Artwork
// Archive and its current price/availability, without touching detail pages.
async function scanListings(log) {
  log('[AA Sync] Scanning listing pages...');
  const page1 = await fetchHtml(`${BASE}/profile/${PROFILE}/embed`);
  const totalPages = parseTotalPages(page1);
  log(`[AA Sync] ${totalPages} listing page(s) found`);

  const bySlug = {};
  parseListingPage(page1).forEach(a => { bySlug[a.slug] = a; });

  for (let p = 2; p <= totalPages; p++) {
    try {
      await sleep(ITEM_DELAY_MS);
      const html = await fetchHtml(`${BASE}/profile/${PROFILE}/embed?page=${p}`);
      parseListingPage(html).forEach(a => { if (!bySlug[a.slug]) bySlug[a.slug] = a; });
      log(`[AA Sync] Listing page ${p}/${totalPages} — ${Object.keys(bySlug).length} total so far`);
    } catch (e) {
      console.warn(`[AA Sync] Listing page ${p} failed: ${e.message}`);
    }
  }

  return bySlug;
}

// ─── MAIN SYNC ─────────────────────────────────────────────────────────────
// mode: 'full'        — re-fetch detail pages (images) for every artwork
//       'incremental'  — only fetch detail pages for slugs we've never seen
//                         before; existing artworks just get price/availability
//                         refreshed from the listing scan (cheap + fast)
async function syncFromArtworkArchive({ verbose = true, mode = 'incremental' } = {}) {
  const log = verbose ? (...a) => console.log(...a) : () => {};
  log('\n[AA Sync] Starting sync from Artwork Archive...');

  // "Prior" state now comes straight from the database, not a JSON cache file —
  // this is what makes the sync actually incremental across server restarts.
  const priorBySlug = {};
  db.getAllArtworks().forEach(a => {
    priorBySlug[a.aaSlug || a.id] = { slug: a.aaSlug || a.id, image: a.image, medium: a.medium };
  });

  const bySlug = await scanListings(log);
  const allSlugs = Object.keys(bySlug);

  // "New" for fetch purposes = never seen before, OR seen but still missing an
  // image (e.g. it failed/got rate-limited on a prior sync attempt).
  const newSlugs = mode === 'full'
    ? allSlugs
    : allSlugs.filter(s => !priorBySlug[s] || !priorBySlug[s].image);
  log(`[AA Sync] ${allSlugs.length} total listed, ${newSlugs.length} need detail-page fetch (${mode} mode)`);

  // Carry forward images/medium for slugs we already have, refresh price/availability
  const artworks = allSlugs.map(slug => {
    const fresh = bySlug[slug];
    const prior = priorBySlug[slug];
    if (prior && !newSlugs.includes(slug)) {
      return { ...fresh, image: prior.image || fresh.image, medium: fresh.medium || prior.medium };
    }
    return fresh;
  });

  const bySlugArr = {};
  artworks.forEach(a => { bySlugArr[a.slug] = a; });

  const stillMissing = [];
  for (let i = 0; i < newSlugs.length; i++) {
    const slug = newSlugs[i];
    try {
      await sleep(ITEM_DELAY_MS);
      const html = await fetchHtml(`${BASE}/profile/${PROFILE}/artwork/${slug}/embed`);
      const { image } = parseDetailPage(html);
      bySlugArr[slug].image = image;
      log(`[AA Sync] New artwork detail ${i + 1}/${newSlugs.length}: ${slug}`);
    } catch (e) {
      console.warn(`[AA Sync] Detail fetch failed for ${slug}: ${e.message}`);
      stillMissing.push(slug);
    }
  }

  // Second pass: anything that failed (almost always a rate-limit run) gets
  // one more try after a cooldown long enough for Cloudflare's window to reset.
  if (stillMissing.length) {
    log(`[AA Sync] ${stillMissing.length} item(s) failed — cooling down ${RATE_LIMIT_COOLDOWN_MS / 1000}s before retry pass...`);
    await sleep(RATE_LIMIT_COOLDOWN_MS * 2);
    for (let i = 0; i < stillMissing.length; i++) {
      const slug = stillMissing[i];
      try {
        await sleep(ITEM_DELAY_MS);
        const html = await fetchHtml(`${BASE}/profile/${PROFILE}/artwork/${slug}/embed`);
        const { image } = parseDetailPage(html);
        bySlugArr[slug].image = image;
        log(`[AA Sync] Retry pass ${i + 1}/${stillMissing.length}: ${slug} ✓`);
      } catch (e) {
        console.warn(`[AA Sync] Retry pass failed permanently for ${slug}: ${e.message}`);
      }
    }
  }

  const finalArtworks = Object.values(bySlugArr);

  const existingById = {};
  db.getAllArtworks().forEach(a => { existingById[a.aaSlug || a.id] = a; });

  const toUpsert = finalArtworks.map(aa => {
    const old = existingById[aa.slug] || {};
    return {
      id:          aa.slug,
      title:       aa.title    || old.title    || aa.slug,
      medium:      aa.medium   || old.medium   || null,
      dims:        aa.dims     || old.dims     || null,
      price:       aa.price != null ? aa.price : (old.price || null),
      available:   aa.available != null ? aa.available : (old.available !== false),
      image:       aa.image    || old.image    || null,
      collection:  old.collection || inferCollection(aa),
      description: old.description || '',
      aaSlug:      aa.slug,
      stripeProductId: old.stripeProductId || null,
      stripePriceId:   old.stripePriceId   || null,
      updatedFromAA:   new Date().toISOString(),
    };
  });

  db.upsertArtworksFromAA(toUpsert);
  db.setMeta('aa_last_synced_at', new Date().toISOString());
  db.setMeta('aa_last_synced_count', String(finalArtworks.length));
  log(`[AA Sync] Saved ${finalArtworks.length} artworks to the database (${newSlugs.length} fetched this run)`);

  return finalArtworks;
}

module.exports = { syncFromArtworkArchive };
