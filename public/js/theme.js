/* ============================================================
   T.S. EATON FINE ART — theme.js
   Animations, mobile menu, FAQ accordion, reviews carousel,
   hero sound toggles. Adapted from the client-provided design.
   Cart logic lives in shop.js.
   ============================================================ */

/* ── HERO: Letter-by-letter animation ── */
(function () {
  const heading = document.getElementById('animatedHeading');
  if (!heading) return;

  const text = heading.getAttribute('data-text') || '';
  heading.innerHTML = [...text].map(char => {
    if (char === ' ') return '<span class="space">&nbsp;</span>';
    return `<span>${char}</span>`;
  }).join('');

  const letters = heading.querySelectorAll('span');
  const letterShowDelay = 220;
  const letterHideDelay = 130;
  const holdAfterComplete = 1200;
  const pauseBeforeRestart = 600;

  function animateHeading() {
    letters.forEach(l => l.classList.remove('show', 'hide'));
    letters.forEach((letter, i) => {
      setTimeout(() => letter.classList.add('show'), i * letterShowDelay);
    });
    const showCompleteTime = letters.length * letterShowDelay + holdAfterComplete;
    letters.forEach((letter, i) => {
      const rev = letters.length - 1 - i;
      setTimeout(() => {
        letters[rev].classList.remove('show');
        letters[rev].classList.add('hide');
      }, showCompleteTime + i * letterHideDelay);
    });
    const totalTime = showCompleteTime + letters.length * letterHideDelay + pauseBeforeRestart;
    setTimeout(animateHeading, totalTime);
  }
  animateHeading();
})();

/* ── SOUND BUTTONS ── */
function toggleSound() {
  const video = document.getElementById('heroVideo');
  const btn = document.getElementById('soundBtn');
  if (!video || !btn) return;
  if (video.muted) {
    video.muted = false; video.play();
    btn.innerHTML = '&#128266;';
  } else {
    video.muted = true;
    btn.innerHTML = '&#128264;';
  }
}
window.toggleSound = toggleSound;

function toggleVidSound(videoId, btnEl) {
  const video = document.getElementById(videoId);
  if (!video || !btnEl) return;
  if (video.muted) {
    video.muted = false; video.play();
    btnEl.innerHTML = '&#128266;';
  } else {
    video.muted = true;
    btnEl.innerHTML = '&#128264;';
  }
}
window.toggleVidSound = toggleVidSound;

/* ── MOBILE MENU ── */
function openMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  if (menu) { menu.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function closeMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  if (menu) { menu.classList.remove('open'); document.body.style.overflow = ''; }
}
window.openMobileMenu = openMobileMenu;
window.closeMobileMenu = closeMobileMenu;
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMobileMenu(); });

/* ── FAQ ACCORDION ── */
function toggleFaq(btn) {
  const item = btn.closest('.faq-item');
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
}
window.toggleFaq = toggleFaq;

/* ── REVIEWS CAROUSEL ── */
(function () {
  let current = 0;
  const track = document.getElementById('reviewsTrack');
  if (!track) return;
  const slides = track.querySelectorAll('.review-slide');
  const total = slides.length;

  function getVisible() {
    if (window.innerWidth < 768) return 1;
    if (window.innerWidth < 1024) return 2;
    return 4;
  }
  function maxIndex() { return Math.max(0, total - getVisible()); }
  function goTo(idx) {
    const vis = getVisible();
    current = Math.max(0, Math.min(idx, maxIndex()));
    const pct = (current / vis) * 100;
    track.style.transform = `translateX(-${pct}%)`;
  }
  window.nextReview = function () { goTo(current + 1); };
  window.prevReview = function () { goTo(current - 1); };

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => goTo(0), 200);
  });
  setInterval(() => {
    if (current >= maxIndex()) goTo(0);
    else goTo(current + 1);
  }, 5000);
})();

/* ── SCROLL-TRIGGERED ANIMATIONS ── */
(function () {
  const animated = document.querySelectorAll('.animated[data-animation]');
  if (!animated.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const cls = el.getAttribute('data-animation');
        el.classList.add(cls, 'animate-done');
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.12 });
  animated.forEach(el => observer.observe(el));
})();

/* ── ZOOM LIGHTBOX (artwork detail page) ── */
function openZoom() {
  const lb = document.getElementById('zoomLightbox');
  const img = document.getElementById('prodMainImg');
  const zImg = document.getElementById('zoomImg');
  if (!lb) return;
  if (img && zImg) zImg.src = img.src;
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeZoom() {
  const lb = document.getElementById('zoomLightbox');
  if (lb) lb.classList.remove('open');
  document.body.style.overflow = '';
}
window.openZoom = openZoom;
window.closeZoom = closeZoom;

document.addEventListener('DOMContentLoaded', () => {
  const lb = document.getElementById('zoomLightbox');
  if (lb) lb.addEventListener('click', e => { if (e.target === lb) closeZoom(); });

  /* ── NO-OP FORMS (newsletter / insider access — not yet wired to a backend) ── */
  document.querySelectorAll('form.js-noop-form').forEach(form => {
    form.addEventListener('submit', e => e.preventDefault());
  });

  /* ── CENTRAL data-action DELEGATION (replaces inline onclick=, required by CSP) ── */
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    switch (el.dataset.action) {
      case 'open-mobile-menu': openMobileMenu(); break;
      case 'close-mobile-menu': closeMobileMenu(); break;
      case 'prev-review': window.prevReview?.(); break;
      case 'next-review': window.nextReview?.(); break;
      case 'toggle-faq': toggleFaq(el); break;
      case 'toggle-sound': toggleSound(); break;
      case 'toggle-vid-sound': toggleVidSound(el.dataset.videoId, el); break;
      case 'open-zoom': openZoom(); break;
      case 'close-zoom': closeZoom(); break;
    }
  });
});
