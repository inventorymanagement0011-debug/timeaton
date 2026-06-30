// views/renderer.js — Server-side HTML generation using the client's
// approved design (tseaton_final template), with dynamic artwork data
// wired in from the database.

const NAV_PAGES = [
  { href: '/', label: 'Home', key: 'home' },
  { href: '/about', label: 'About Us', key: 'about' },
  { href: '/landscape-collection', label: 'Landscape', key: 'landscape' },
  { href: '/contemporary-collection', label: 'Contemporary', key: 'contemporary' },
  { href: '/my-process', label: 'My Process', key: 'process' },
];

const SOCIAL_ICONS = `
  <a href="#" class="social-icon" aria-label="Facebook"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg></a>
  <a href="#" class="social-icon" aria-label="Youtube"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.41 19.54C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.96A29 29 0 0023 12a29 29 0 00-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg></a>
  <a href="#" class="social-icon" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a>
  <a href="#" class="social-icon" aria-label="TikTok"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V9.17a8.16 8.16 0 004.77 1.52V7.24a4.85 4.85 0 01-1-.55z"/></svg></a>`;

const REVIEWS = [
  { text: 'I&#8217;m sitting in my early morning chair, the sun is shining and i am looking at your beautiful painting. I&#8217;m grateful i am able to enjoy such an amazing sight every day. thank you', author: 'Eileen o.' },
  { text: 'I commission Tim to paint three landmark tree specimens on my property. They are a constant source of inspiration and pride i share with friends and guest on a regular basis', author: 'KEN C.' },
  { text: 'I&#8217;m fortunate to have two of tim eaton&#8217;s majestic landscape paintings. what draws me to his work is his sense of calm and belongingness. his use of earthy colors and soft brush strokes evoke a transcendent and a placid sort of light. it&#8217;s really quite magical!', author: 'Rob r.' },
  { text: 'It didn&#8217;t take much convincing to make &#8220;Inner workings&#8221; My very own, and now that it is, my spirits lift each time i walk by it. So glad i made that decision!', author: 'CYNTHIA. J.' },
];

const FAQS = [
  { q: 'Are the artworks available in different sizes or formats?', open: true },
  { q: 'Do you offer international shipping?' },
  { q: 'Are these artworks part of a limited collection?' },
  { q: 'Can I schedule a private viewing or consultation?' },
  { q: 'How long does shipping take?' },
  { q: 'What payment methods do you accept?' },
];
const FAQ_ANSWER = 'Yes! Many of our pieces are offered in a variety of sizes and framing options. Whether you&#8217;re looking for a statement piece or something more intimate, we can help you find the perfect fit for your space.';

// ─── SHARED PARTIALS ───────────────────────────────────────────────────────

function head(title = 'Tim Eaton – Fine Art', desc = '') {
  return `<!DOCTYPE html>
<html lang="en-US">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<meta name="description" content="${desc || 'Tim Eaton is a nationally recognized fine artist working in landscape and contemporary collections.'}">
<link rel="icon" href="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/logo3dmodel-1.png"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,700;1,300;1,400&family=Roboto:wght@300;400;500;600&family=Roboto+Slab:wght@300;400;600&display=swap" rel="stylesheet"/>
<link rel="stylesheet" href="/css/theme.css"/>
</head>
<body>`;
}

function mobileMenu() {
  return `
<div id="mobileMenu" class="mobile-menu">
  <button class="mobile-menu-close" data-action="close-mobile-menu" aria-label="Close">&#x2715;</button>
  <nav class="mobile-menu-nav">
    ${NAV_PAGES.map(p => `<a href="${p.href}">${p.label}</a>`).join('\n    ')}
  </nav>
</div>`;
}

function header(current = '') {
  return `
<header id="hdr-trnsprent" class="site-header">
  <div id="inr-trnsprent" class="header-inner">
    <div id="logo-bck" class="header-logo">
      <a href="/">
        <img src="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/Group-1261153202.png" alt="T.S. Eaton Fine Art" width="176" height="138"/>
      </a>
    </div>
    <nav class="header-nav">
      ${NAV_PAGES.map(p => `<a href="${p.href}" class="nav-item${p.key === current ? ' active' : ''}">${p.label}</a>`).join('\n      ')}
    </nav>
    <div class="header-right">
      <div class="cart-wrap">
        <a href="/cart" class="cart-btn" aria-label="Cart">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
          </svg>
          <span class="cart-count" id="cartCount">0</span>
          <span class="cart-label">Cart</span>
        </a>
      </div>
      <a href="/account" class="login-btn">Login</a>
      <button class="hamburger-btn" data-action="open-mobile-menu" aria-label="Open menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
</header>`;
}

function reviewsSection() {
  return `
<section class="reviews-section">
  <div class="reviews-inner">
    <div class="reviews-header">
      <h2 class="section-title">Collector Reviews</h2>
      <a href="#" class="btn-blue-outline">View all Collector Reviews</a>
    </div>
    <div class="reviews-carousel-wrap">
      <div class="reviews-track" id="reviewsTrack">
        ${REVIEWS.map(r => `
        <div class="review-slide">
          <div class="review-card">
            <p class="review-text">&#8220;${r.text}&#8221;</p>
            <div class="review-footer">
              <div class="review-dot"></div>
              <p class="review-author">${r.author}</p>
              <div class="review-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
            </div>
          </div>
        </div>`).join('')}
      </div>
      <button class="carousel-prev" data-action="prev-review" aria-label="Previous">&#8249;</button>
      <button class="carousel-next" data-action="next-review" aria-label="Next">&#8250;</button>
    </div>
  </div>
</section>`;
}

function faqSection() {
  return `
<section class="faq-section">
  <div class="faq-inner">
    <div class="faq-img-col animated slideInLeft" data-animation="slideInLeft">
      <img src="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/Group-1261153208.png" alt="Tim Eaton" loading="lazy"/>
    </div>
    <div class="faq-accordion-col">
      <h2 class="section-title">Frequently Asked Questions</h2>
      ${FAQS.map(f => `
      <div class="faq-item${f.open ? ' open' : ''}">
        <button class="faq-question" data-action="toggle-faq">
          ${f.q}
          <span class="faq-icon">+</span>
        </button>
        <div class="faq-answer"><p>${FAQ_ANSWER}</p></div>
      </div>`).join('')}
    </div>
  </div>
</section>`;
}

function footer() {
  return `
<footer class="site-footer">
  <div class="newsletter-section">
    <div class="newsletter-inner">
      <div class="newsletter-text">
        <h2>Subscribe my Newsletter</h2>
        <p>Subscribe to our newsletter to receive updates on new artworks, exhibitions, exclusive releases, and important announcements.</p>
      </div>
      <div class="newsletter-form-wrap">
        <form class="newsletter-form js-noop-form">
          <input type="email" placeholder="Email" class="newsletter-input" aria-label="Email"/>
          <button type="submit" class="btn-primary">Subscribe Now</button>
        </form>
      </div>
    </div>
  </div>
  <div class="footer-bottom">
    <div class="footer-bottom-inner">
      <div class="footer-col">
        <h4>Get In Touch</h4>
        <p><strong>Mailing Address:</strong></p>
        <p>425 Fairfield Avenue, Bldg#4 Suite #4211<br>Stamford, CT 06902</p>
        <p><strong>Email:</strong><br><a href="mailto:timeatonart@gmail.com">timeatonart@gmail.com</a></p>
        <p><strong>Phone:</strong><br><a href="tel:+19149066345">+1 (914) 906 6345</a></p>
      </div>
      <div class="footer-col">
        <h4>Information</h4>
        <a href="/">Home</a>
        <a href="/about">About us</a>
        <a href="/landscape-collection">All Collections</a>
      </div>
      <div class="footer-col">
        <h4>Follow Us</h4>
        <div class="social-icons">${SOCIAL_ICONS}</div>
      </div>
    </div>
    <div class="footer-copyright">
      <p>Copyright &copy; 2026 T.S.EATON FINE ART | All Rights Reserved.</p>
    </div>
  </div>
</footer>
<script src="/js/theme.js"></script>
<script src="/js/shop.js"></script>
</body>
</html>`;
}

function productCard(a, delay) {
  const hasPrice = a.price && a.price > 0;
  const priceStr = hasPrice ? `$${Number(a.price).toLocaleString('en-US')}` : 'Inquire';
  const meta = [a.medium, a.dims].filter(Boolean).join(' · ');
  const imgSrc = a.image || 'https://placehold.co/600x400/CCCCCC/666?text=Loading...';
  const style = delay ? ` style="animation-delay:${delay}s"` : '';

  return `
<div class="product-card animated zoomIn" data-animation="zoomIn" data-collection="${a.collection || ''}" data-available="${!!a.available}"${style}>
  <a href="/artwork/${a.id}" class="product-card-img-link">
    <img src="${imgSrc}" alt="${a.title}" loading="lazy"/>
  </a>
  <div class="product-card-info">
    <h3><a href="/artwork/${a.id}">${a.title}</a></h3>
    <p class="product-edition">${meta || 'Original artwork'}</p>
    <p class="product-dims">${priceStr}${!a.available ? ' · Sold' : ''}</p>
    ${a.available && hasPrice
      ? `<button class="acquire-link" style="background:none;border:none;cursor:pointer;font:inherit"
          data-artwork-id="${a.id}"
          data-artwork-title="${a.title.replace(/"/g, '&quot;')}"
          data-artwork-price="${a.price}"
          data-artwork-image="${imgSrc}"
          data-artwork-meta="${meta.replace(/"/g, '&quot;')}">Acquire this Painting</button>`
      : a.available
        ? `<a href="mailto:timeatonart@gmail.com?subject=Inquiry: ${encodeURIComponent(a.title)}" class="acquire-link">Inquire</a>`
        : `<span class="acquire-link" style="color:#999;border-color:#999">Sold</span>`
    }
  </div>
</div>`;
}

// ─── PAGE RENDERERS ────────────────────────────────────────────────────────

function renderHome(db) {
  const artworks = db.getAllArtworks().slice(0, 8);
  return [
    head('Tim Eaton – Fine Art'),
    mobileMenu(), header('home'),
    `<div class="hero-section">
  <video id="heroVideo" autoplay muted loop playsinline class="hero-video">
    <source src="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/Homepage-banner.mp4" type="video/mp4"/>
  </video>
  <div class="hero-overlay"></div>
  <div class="hero-content">
    <div class="heading-mask">
      <h1 id="animatedHeading" class="animated-heading" data-text="Bring The Feeling Home"></h1>
    </div>
  </div>
  <button class="sound-btn" data-action="toggle-sound" id="soundBtn">&#128264;</button>
</div>

<section class="about-section animated fadeInUp" data-animation="fadeInUp">
  <div class="about-inner">
    <div class="about-img-col animated fadeInUp" data-animation="fadeInUp">
      <img src="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/Group-1261153202-2.png" alt="Tim Eaton" loading="lazy" width="800" height="701"/>
    </div>
    <div class="about-text-col animated fadeInRight" data-animation="fadeInRight">
      <h2 class="about-heading">Tim Eaton</h2>
      <p>is a nationally recognized* fine artist celebrated for his ability to merge his natural vision, his view of the world with emotional depth. His work captures fleeting moments—reflections, shadows, and bursts of light—that challenge the viewer to look beyond the surface to find deep connection.</p>
      <p class="about-award">* 2025 Winner of the prestigious Faber Birren National Color Award</p>
      <p>&#8220;My art is about a profound connection to the world I remember growing up in&#8212;shifting it, interpreting it, and often surrendering to it. Through light, composition, and quietude, I try to distill this emotion into form.&#8221;</p>
      <p>Tim&#8217;s creative process is rooted in memories, imagination and a sense of tranquility. From quiet, gurgling brooks to wide open vistas, each piece reflects a quiet complexity that invites introspection. His work has been showcased in galleries in Vermont, Maine, and Connecticut as well as in private collections throughout the US and Europe.</p>
      <p class="about-quote-small">It is all very well to copy what you see; it is much better still to draw what you only see in memory...degas</p>
      <a href="/about" class="btn-primary">Learn More</a>
    </div>
  </div>
</section>

<section class="collections-section">
  <div class="collections-inner">
    <div class="collections-header">
      <div class="collections-header-left">
        <h2 class="section-title">The Collections</h2>
        <p class="section-sub">Every piece tells a story&#8212;inviting you to see, feel, and explore what the artist is experiencing...</p>
      </div>
      <a href="/landscape-collection" class="btn-outline-dark">Learn More</a>
    </div>
    <div class="product-grid">
      ${artworks.map((a, i) => productCard(a, (i % 4) * 0.1)).join('')}
      ${artworks.length === 0 ? '<p style="grid-column:1/-1;text-align:center;padding:3rem 0;color:#888">No artworks yet — use the Admin panel to add some or run a sync.</p>' : ''}
    </div>
  </div>
</section>

<section class="assoc-section">
  <div class="assoc-inner">
    <div class="assoc-text-col">
      <h2 class="section-title">In Association with</h2>
      <p>A professional painter engaged in the creation of original visual artworks with a commitment to artistic excellence and craftsmanship.</p>
    </div>
    <div class="assoc-logos-col">
      <img src="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/Group-1261153009.png" alt="Salida" loading="lazy"/>
      <img src="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/Group-1261153010-1.png" alt="Arts Forum" loading="lazy"/>
      <img src="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/Group-1261153012.png" alt="Greenwich Sentinel" loading="lazy"/>
      <img src="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/Group-1261153014.png" alt="The Bruce" loading="lazy"/>
    </div>
  </div>
</section>

${reviewsSection()}
${faqSection()}`,
    footer()
  ].join('');
}

function renderCollectionPage(db, collection, title, heroSrc, quote) {
  const artworks = db.getArtworksByCollection(collection);
  return [
    head(`${title} – Tim Eaton Fine Art`),
    mobileMenu(), header(collection),
    `<div class="page-hero-section">
  <video id="${collection}Video" autoplay muted loop playsinline class="page-hero-video">
    <source src="${heroSrc}" type="video/mp4"/>
  </video>
  <div class="page-hero-overlay"></div>
  <div class="page-hero-content">
    <h1 class="page-hero-heading">${title}</h1>
    <p class="page-hero-sub">Experience the Transcendent Vision of T. S. Eaton</p>
    <div class="page-hero-btns">
      <a href="#collection" class="btn-primary">Shop the Collection</a>
      <button class="sound-btn-inline" data-action="toggle-vid-sound" data-video-id="${collection}Video" aria-label="Toggle sound">&#128264;</button>
    </div>
  </div>
</div>

${quote ? `
<section class="quote-banner-section">
  <div class="quote-banner-inner animated fadeInUp" data-animation="fadeInUp">
    <blockquote>${quote}</blockquote>
    <cite>T.S. Eaton</cite>
  </div>
</section>` : ''}

<section class="collections-section" id="collection">
  <div class="collections-inner">
    <div class="collections-header animated fadeInUp" data-animation="fadeInUp">
      <div class="collections-header-left">
        <h2 class="section-title">${title}s</h2>
        <p class="section-sub">Every piece tells a story&#8212;inviting you to see, feel, and explore what the artist is experiencing.</p>
      </div>
    </div>
    <div class="product-grid">
      ${artworks.map((a, i) => productCard(a, (i % 4) * 0.1)).join('') || '<p style="grid-column:1/-1;text-align:center;padding:3rem 0;color:#888">No artworks in this collection yet.</p>'}
    </div>
  </div>
</section>

${reviewsSection()}
${faqSection()}`,
    footer()
  ].join('');
}

function renderShop(db) {
  const artworks = db.getAllArtworks();
  return [
    head('Shop All Works – Tim Eaton Fine Art'),
    mobileMenu(), header(''),
    `<div class="page-hero-section">
  <video id="shopVideo" autoplay muted loop playsinline class="page-hero-video">
    <source src="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/Homepage-banner.mp4" type="video/mp4"/>
  </video>
  <div class="page-hero-overlay"></div>
  <div class="page-hero-content">
    <h1 class="page-hero-heading">Shop All Works</h1>
    <p class="page-hero-sub">Acquire a piece of Tim's world — every work ships insured, directly from the studio.</p>
  </div>
</div>

<section class="collections-section" id="collection">
  <div class="collections-inner">
    <div class="collections-header">
      <div class="collections-header-left">
        <h2 class="section-title">All Works</h2>
        <p class="section-sub">Browse the complete collection.</p>
      </div>
    </div>
    <div class="page-hero-btns" style="margin-bottom:24px">
      <button class="btn-primary filter-btn active" data-filter="all" style="padding:10px 22px;font-size:13px">All Works</button>
      <button class="btn-outline-dark filter-btn" data-filter="landscape" style="padding:10px 22px;font-size:13px;background:#fff;color:#20699C;border:1px solid #20699C">Landscape</button>
      <button class="btn-outline-dark filter-btn" data-filter="contemporary" style="padding:10px 22px;font-size:13px;background:#fff;color:#20699C;border:1px solid #20699C">Contemporary</button>
      <button class="btn-outline-dark filter-btn" data-filter="available" style="padding:10px 22px;font-size:13px;background:#fff;color:#20699C;border:1px solid #20699C">Available Only</button>
    </div>
    <div class="product-grid" id="shop-grid">
      ${artworks.map((a, i) => productCard(a, (i % 4) * 0.1)).join('') || '<p style="grid-column:1/-1;text-align:center;padding:3rem 0;color:#888">No artworks yet.</p>'}
    </div>
  </div>
</section>
${faqSection()}`,
    footer()
  ].join('');
}

function renderArtwork(artwork) {
  const hasPrice = artwork.price && artwork.price > 0;
  const priceStr = hasPrice ? `$${Number(artwork.price).toLocaleString('en-US')}` : null;
  const imgSrc = artwork.image || 'https://placehold.co/800x600/CCCCCC/666?text=Loading...';
  const meta = [artwork.medium, artwork.dims].filter(Boolean).join(' · ');

  return [
    head(`${artwork.title} – Tim Eaton Fine Art`, artwork.description),
    mobileMenu(), header(''),
    `<section class="product-page-section">
  <div class="product-page-inner">
    <div class="prod-gallery animated fadeInUp" data-animation="fadeInUp">
      <div class="prod-main-img">
        <img id="prodMainImg" src="${imgSrc}" alt="${artwork.title}"/>
        <button class="prod-zoom-btn" data-action="open-zoom" aria-label="Zoom">&#9979;</button>
      </div>
    </div>
    <div class="prod-info animated fadeInRight" data-animation="fadeInRight">
      <p class="prod-cat">Category: <a href="/${artwork.collection === 'contemporary' ? 'contemporary' : 'landscape'}-collection">${artwork.collection === 'contemporary' ? 'Contemporary' : 'Landscape'}</a></p>
      <h1>${artwork.title}</h1>
      ${priceStr ? `<p class="prod-price">${priceStr}</p>` : ''}
      <ul>
        ${artwork.medium ? `<li>${artwork.medium}</li>` : ''}
        ${artwork.dims ? `<li>${artwork.dims}</li>` : ''}
        ${artwork.edition ? `<li>${artwork.edition}</li>` : ''}
      </ul>
      ${artwork.description ? `<p class="prod-desc">${artwork.description}</p>` : ''}
      <div class="prod-cart-row">
        ${artwork.available && hasPrice
          ? `<button class="btn-primary"
              data-artwork-id="${artwork.id}"
              data-artwork-title="${artwork.title.replace(/"/g, '&quot;')}"
              data-artwork-price="${artwork.price}"
              data-artwork-image="${imgSrc}"
              data-artwork-meta="${meta.replace(/"/g, '&quot;')}">Add to cart</button>`
          : artwork.available
            ? `<a href="mailto:timeatonart@gmail.com?subject=Inquiry: ${encodeURIComponent(artwork.title)}" class="btn-primary">Inquire About This Piece</a>`
            : `<span class="btn-primary" style="background:#999">This piece has found its home</span>`
        }
      </div>
      <div id="addedNotif" class="added-notif"></div>
      <p style="font-family:'Roboto',sans-serif;font-size:13px;color:#888;margin-top:20px">Questions? <a href="mailto:timeatonart@gmail.com" style="color:#20699C">timeatonart@gmail.com</a> &middot; <a href="tel:+19149066345" style="color:#20699C">+1 (914) 906 6345</a></p>
    </div>
  </div>
</section>

<div id="zoomLightbox" class="zoom-lightbox">
  <button class="zoom-close" data-action="close-zoom" aria-label="Close">&#10005;</button>
  <img id="zoomImg" src="" alt="Zoomed view"/>
</div>`,
    footer()
  ].join('');
}

function renderAbout() {
  return [
    head('About Us – Tim Eaton Fine Art'),
    mobileMenu(), header('about'),
    `<div class="page-hero-section">
  <video id="aboutVideo" autoplay muted loop playsinline class="page-hero-video">
    <source src="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/About-Us-VIDEO.mp4" type="video/mp4"/>
  </video>
  <div class="page-hero-overlay"></div>
  <div class="page-hero-content">
    <p class="page-hero-eyebrow">Meet The Creative Behind The Art</p>
    <h1 class="page-hero-heading">Most art is there to be seen,<br>This Collection is yours to be felt</h1>
    <div class="page-hero-btns">
      <a href="/landscape-collection" class="btn-primary">My Collection</a>
      <button class="sound-btn-inline" data-action="toggle-vid-sound" data-video-id="aboutVideo" aria-label="Toggle sound">&#128264;</button>
    </div>
  </div>
</div>

<section class="quote-banner-section">
  <div class="quote-banner-inner animated fadeInUp" data-animation="fadeInUp">
    <blockquote>&#8220;If you&#8217;re like me, a good book is hard to put down and a great movie is never forgotton. I offer uniquely painted pictures you&#8217;ll want adorning your walls that withstand the test of time, to pass down through the generations...&#8221;</blockquote>
    <cite>T.S. Eaton</cite>
  </div>
</section>

<section class="about-section">
  <div class="about-inner">
    <div class="about-img-col animated fadeInUp" data-animation="fadeInUp">
      <img src="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/Group-1261153202-2.png" alt="Tim Eaton" loading="lazy"/>
    </div>
    <div class="about-text-col animated fadeInRight" data-animation="fadeInRight">
      <h2 class="about-heading">Tim Eaton</h2>
      <p>is a nationally recognized* fine artist celebrated for his ability to merge his natural vision, his view of the world with emotional depth. His work captures fleeting moments&#8212;reflections, shadows, and bursts of light&#8212;that challenge the viewer to look beyond the surface to find deep connection.</p>
      <p class="about-award">* 2025 Winner of the prestigious Faber Birren National Color Award</p>
      <p>&#8220;My art is about a profound connection to the world I remember growing up in&#8212;shifting it, interpreting it, and often surrendering to it. Through light, composition, and quietude, I try to distill this emotion into form.&#8221;</p>
      <p>Tim&#8217;s creative process is rooted in memories, imagination and a sense of tranquility. From quiet, gurgling brooks to wide open vistas, each piece reflects a quiet complexity that invites introspection. His work has been showcased in galleries in Vermont, Maine, and Connecticut as well as in private collections throughout the US and Europe.</p>
      <p class="about-quote-small">It is all very well to copy what you see; it is much better still to draw what you only see in memory...degas</p>
    </div>
  </div>
</section>

<section class="art-gallery-section">
  <div class="art-gallery-inner">
    <h2 class="section-title animated fadeInUp" data-animation="fadeInUp">My Art, Your Home</h2>
    <div class="art-gallery-grid">
      <img src="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/Group-1261153214.png" alt="Art in home" loading="lazy" class="animated zoomIn" data-animation="zoomIn"/>
      <img src="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/Group-1261153213.png" alt="Art in home" loading="lazy" class="animated zoomIn" data-animation="zoomIn" style="animation-delay:0.1s"/>
      <img src="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/Group-1261153212.png" alt="Art in home" loading="lazy" class="animated zoomIn" data-animation="zoomIn" style="animation-delay:0.2s"/>
      <img src="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/Group-1261153211.png" alt="Art in home" loading="lazy" class="animated zoomIn" data-animation="zoomIn" style="animation-delay:0.3s"/>
      <img src="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/Group-1261153210.png" alt="Art in home" loading="lazy" class="animated zoomIn" data-animation="zoomIn"/>
      <img src="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/Group-1261153209.png" alt="Art in home" loading="lazy" class="animated zoomIn" data-animation="zoomIn" style="animation-delay:0.1s"/>
      <img src="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/Group-1261153208.png" alt="Art in home" loading="lazy" class="animated zoomIn" data-animation="zoomIn" style="animation-delay:0.2s"/>
      <img src="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/Group-1261153202-3.png" alt="Art in home" loading="lazy" class="animated zoomIn" data-animation="zoomIn" style="animation-delay:0.3s"/>
    </div>
  </div>
</section>

<section class="bespoke-section">
  <div class="bespoke-inner animated fadeInUp" data-animation="fadeInUp">
    <h2 class="section-title">Bespoke Collector&#8217;s Prints for the Discerning Collector</h2>
    <p>Tim&#8217;s uniquely personal visions are created to spark conversation and captivate the imagination. Each piece can be custom sized, using state-of-the-art digital technology, hand embellished and signed in limited editions to meet the requirements of any space&#8212;ensuring your collection remains unique and timeless.</p>
    <p>From private residences to corporate installations, T.S.Eaton&#8217;s visions are found in collections both here in the States and abroad. Invest in artwork that transforms your environment, bringing depth, emotional appeal and sophistication to every space.</p>
    <a href="/landscape-collection" class="btn-primary">View Limited Edition Prints</a>
  </div>
</section>

${reviewsSection()}

<section class="contact-section">
  <div class="contact-inner animated fadeInUp" data-animation="fadeInUp">
    <div class="contact-img-col">
      <img src="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/Group-1261153208.png" alt="Tim Eaton" loading="lazy"/>
    </div>
    <div class="contact-form-col">
      <h2>Get insider access to new collections, events, and more.</h2>
      <p>Your email address will never be shared with a third party without your written permission.</p>
      <form class="js-noop-form">
        <div class="form-row">
          <div class="form-field"><label>First Name</label><input type="text" placeholder="Enter First Name"/></div>
          <div class="form-field"><label>Last Name</label><input type="text" placeholder="Enter Last Name"/></div>
        </div>
        <div class="form-field"><label>Email</label><input type="email" placeholder="Enter email address"/></div>
        <div class="form-field"><label>Complete Address*</label><input type="text" placeholder="Enter your address"/></div>
        <label class="form-check"><input type="checkbox"/> I understand the Terms &amp; Conditions</label>
        <button type="submit" class="btn-primary">Submit Now</button>
      </form>
    </div>
  </div>
</section>

<section class="process-text-section">
  <div class="process-text-inner animated fadeInUp" data-animation="fadeInUp">
    <p class="process-eyebrow">The Process</p>
    <h2 class="section-title">Art begins long before the first stroke.</h2>
    <p>Inspiration can strike in the smallest of moments&#8212;a shadow dancing across a wall, the texture of weathered stone, or the quiet stillness of dawn. For Tim Eaton, the process demands keen observation, an intense commitment to patience, and a willingness to allow forces beyond the co-ordination between eye and hand to flow into the piece, through emotion, and experience.</p>
    <p>Every composition is a deliberate act, balancing form and feeling. When standing before a canvas, Tim crafts pieces that invite reflection and connection. These works become more than visual&#8212;they become experiences that resonate deeply, offering viewers a chance to pause, feel, and rediscover the beauty hidden in the everyday.</p>
  </div>
</section>

${faqSection()}`,
    footer()
  ].join('');
}

function renderProcess() {
  return [
    head('My Process – Tim Eaton Fine Art'),
    mobileMenu(), header('process'),
    `<div class="process-hero-section">
  <img src="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/image-989.png" alt="Tim Eaton with paintings" class="process-hero-img"/>
  <div class="process-hero-overlay"></div>
  <div class="process-hero-content">
    <h1 class="process-hero-heading">Time Lapse Videos</h1>
    <p>Not only do you love art, you love to see how it is done! This artist has spent countless hours producing exciting video content describing his experience in front of the canvas. Notice how all of these pieces come together without the use of photo reference. That&#8217;s because the work he creates is derived from within. Sometimes, watching the process of a painting&#8217;s birth is more interesting than the piece itself. If this is you, this is your page!</p>
    <a href="https://www.artworkarchive.com/profile/tim-eaton" target="_blank" rel="noopener" class="btn-primary">See More Available Work On Artwork Archive</a>
  </div>
</div>

<section class="videos-section">
  <div class="videos-inner">
    <div class="video-grid">
      <div class="video-large">
        <video controls preload="metadata" poster="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/Rectangle-45438.png">
          <source src="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/The-Process-1.mp4" type="video/mp4"/>
        </video>
      </div>
      <div class="video-stack">
        <video controls preload="metadata" poster="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/Rectangle-45438-1.png">
          <source src="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/The-Process-2.mp4" type="video/mp4"/>
        </video>
        <video controls preload="metadata" poster="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/Rectangle-45438-2.png">
          <source src="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/The-Process-3.mp4" type="video/mp4"/>
        </video>
      </div>
    </div>
  </div>
</section>

<section class="inquiry-section">
  <div class="inquiry-inner animated fadeInUp" data-animation="fadeInUp">
    <img src="https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/Group-1261153202-3.png" alt="Tim Eaton" loading="lazy"/>
    <div class="inquiry-text">
      <p>To acquire any one of these fascinating works of art, push the inquiry button. Tim will send you the piece AND the process video.</p>
      <a href="mailto:timeatonart@gmail.com?subject=Inquiry" class="btn-primary">Inquiry Now</a>
    </div>
  </div>
</section>

${reviewsSection()}
${faqSection()}`,
    footer()
  ].join('');
}

function renderCart() {
  return [
    head('Your Cart – Tim Eaton Fine Art'),
    mobileMenu(), header(''),
    `<section class="cart-page-section">
  <div class="cart-page-inner">
    <h1>Your Cart</h1>
    <div id="cartEmptyState" class="cart-empty-state" style="display:none">
      <p>Your cart is empty. Browse the collections to find a piece you love.</p>
      <a href="/shop" class="btn-primary">Shop All Works</a>
    </div>
    <div id="cartList"></div>
    <div id="cartSummary" class="cart-summary" style="display:none">
      <div>
        <div class="cart-summary-total">Total: <span id="cartTotal">$0</span></div>
        <div class="cart-summary-note">Secure checkout via Stripe &middot; Free domestic shipping &middot; Each piece ships insured</div>
      </div>
      <button id="cartCheckoutBtn" class="btn-primary cart-checkout-btn" disabled>Proceed to Checkout</button>
    </div>
  </div>
</section>
<script>document.addEventListener('DOMContentLoaded', () => { if (window.renderCartPage) window.renderCartPage(); });</script>`,
    footer()
  ].join('');
}

function renderAccount() {
  return [
    head('My Account – Tim Eaton Fine Art'),
    mobileMenu(), header(''),
    `<section class="account-page-section">
  <div class="account-page-inner">
    <div class="account-card">
      <h2>Welcome</h2>
      <p class="account-sub">We keep checkout simple — every purchase is a fast, secure guest checkout via Stripe. No account or password required, ever.</p>
      <a href="/shop" class="btn-primary" style="width:100%;text-align:center;display:block">Browse the Collections</a>
    </div>
    <div class="account-card">
      <h2>Track Your Order</h2>
      <p class="account-sub">Enter the email you used at checkout and your order confirmation number to check your order status.</p>
      <form id="trackOrderForm">
        <div class="form-field">
          <label>Email</label>
          <input type="email" id="trackEmail" placeholder="you@example.com" required/>
        </div>
        <div class="form-field">
          <label>Order Confirmation Number</label>
          <input type="text" id="trackOrderId" placeholder="cs_..." required/>
        </div>
        <button type="submit" class="btn-primary">Track Order</button>
      </form>
      <div id="trackResult" class="account-result"></div>
    </div>
  </div>
</section>
<script>
document.getElementById('trackOrderForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('trackEmail').value.trim();
  const orderId = document.getElementById('trackOrderId').value.trim();
  const result = document.getElementById('trackResult');
  result.className = 'account-result show';
  result.textContent = 'Looking up your order...';
  try {
    const res = await fetch('/account/track-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, orderId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Order not found');
    result.className = 'account-result show success';
    result.innerHTML = '<div class="order-row"><span>Artwork</span><span>' + (data.artworkTitle || '—') + '</span></div>' +
      '<div class="order-row"><span>Status</span><span>' + data.status + '</span></div>' +
      '<div class="order-row"><span>Amount</span><span>$' + data.amount + '</span></div>' +
      '<div class="order-row"><span>Date</span><span>' + new Date(data.createdAt).toLocaleDateString() + '</span></div>';
  } catch (err) {
    result.className = 'account-result show error';
    result.textContent = err.message || 'We could not find an order with those details.';
  }
});
</script>`,
    footer()
  ].join('');
}

// ─── MAIN DISPATCHER ───────────────────────────────────────────────────────

function renderPage(page, db, extra = null) {
  switch (page) {
    case 'home': return renderHome(db);
    case 'shop': return renderShop(db);
    case 'landscape': return renderCollectionPage(
      db, 'landscape', 'Landscape Collection',
      'https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/Landscape-Collection.mp4',
      '&#8220;My landscape work is a direct reflection of my memories &#8212; the places I grew up in, walked through, and carry with me. Each piece is an act of remembering, not recording.&#8221;'
    );
    case 'contemporary': return renderCollectionPage(
      db, 'contemporary', 'Contemporary Collection',
      'https://timeaton.thebeamhive.com/wp-content/uploads/2026/05/Contemporary-Collection-BANNER.mp4',
      '&#8220;This collection is rooted in the concept of time and how materials change with the elements. I demonstrate this through the use of iron, copper, and bronze oxide paints, exposed to solutions that allow these oxides to develop their own natural aged beauty.&#8221;'
    );
    case 'about': return renderAbout();
    case 'process': return renderProcess();
    case 'artwork': return renderArtwork(extra);
    case 'cart': return renderCart();
    case 'account': return renderAccount();
    default: return renderHome(db);
  }
}

module.exports = { renderPage };
