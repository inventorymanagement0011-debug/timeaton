/* ============================================================
   TIMEATON SHOP — Cart state, multi-item Stripe Checkout,
   product card wiring. Works across every page (cart lives in
   localStorage) and on the dedicated /cart page.
   ============================================================ */
(() => {
  'use strict';

  const CART_KEY = 'timeaton_cart';

  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch { return []; }
  }
  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }
  function addToCart(artwork) {
    const cart = loadCart();
    if (cart.find(i => i.id === artwork.id)) {
      showToast(`"${artwork.title}" is already in your cart.`);
      return;
    }
    cart.push({ ...artwork, qty: 1 });
    saveCart(cart);
    updateCartCount();
    showToast(`"${artwork.title}" added to your cart.`);
  }
  function removeFromCart(id) {
    saveCart(loadCart().filter(i => i.id !== id));
    updateCartCount();
    renderCartPage();
  }
  function clearCart() {
    saveCart([]);
    updateCartCount();
  }

  function updateCartCount() {
    const cart = loadCart();
    document.querySelectorAll('#cartCount').forEach(el => { el.textContent = cart.length; });
  }
  window.updateCartCount = updateCartCount;

  /* ── TOAST ── */
  let toastTimer;
  function showToast(msg, type = 'success') {
    let toast = document.getElementById('__toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = '__toast';
      toast.style.cssText = `
        position:fixed;bottom:2rem;left:50%;transform:translateX(-50%) translateY(120%);
        background:#111;color:#fff;font-family:'Roboto',sans-serif;font-size:13px;
        padding:12px 22px;border-radius:6px;z-index:99999;
        transition:transform .3s cubic-bezier(.22,.61,.36,1);
        max-width:90vw;text-align:center;box-shadow:0 4px 16px rgba(0,0,0,.25);
      `;
      document.body.appendChild(toast);
    }
    toast.style.background = type === 'error' ? '#b23b3b' : '#111';
    toast.textContent = msg;
    toast.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.style.transform = 'translateX(-50%) translateY(120%)'; }, 3500);
  }

  /* ── CART PAGE RENDER ── */
  function renderCartPage() {
    const list = document.getElementById('cartList');
    if (!list) return;
    const cart = loadCart();
    const emptyState = document.getElementById('cartEmptyState');
    const summary = document.getElementById('cartSummary');
    const checkoutBtn = document.getElementById('cartCheckoutBtn');

    if (cart.length === 0) {
      list.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      if (summary) summary.style.display = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (summary) summary.style.display = 'flex';

    list.innerHTML = cart.map(item => `
      <div class="cart-row" data-item-id="${item.id}">
        <img src="${item.image}" alt="${item.title}">
        <div>
          <div class="cart-row-title">${item.title}</div>
          <div class="cart-row-meta">${item.meta || ''}</div>
        </div>
        <div class="cart-row-price">$${(item.price || 0).toLocaleString('en-US')}</div>
        <button class="cart-row-remove" data-remove="${item.id}" aria-label="Remove ${item.title}">&#10005;</button>
      </div>
    `).join('');

    list.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => removeFromCart(btn.getAttribute('data-remove')));
    });

    const total = cart.reduce((s, i) => s + (i.price || 0), 0);
    const totalEl = document.getElementById('cartTotal');
    if (totalEl) totalEl.textContent = '$' + total.toLocaleString('en-US');
    if (checkoutBtn) checkoutBtn.disabled = false;
  }
  window.renderCartPage = renderCartPage;

  /* ── STRIPE CHECKOUT (multi-item) ── */
  async function startCheckout() {
    const cart = loadCart();
    if (cart.length === 0) return;
    const btn = document.getElementById('cartCheckoutBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Redirecting to checkout…'; }

    try {
      const res = await fetch('/api/checkout/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artworkIds: cart.map(i => i.id) }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Checkout unavailable');
      if (data.url) {
        clearCart();
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      console.error('[checkout]', err);
      showToast('Checkout unavailable right now. Please try again or email timeatonart@gmail.com', 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Proceed to Checkout'; }
    }
  }
  window.startCheckout = startCheckout;

  /* ── WIRE "ACQUIRE" / ADD-TO-CART BUTTONS (product cards + detail page) ── */
  function wireBuyButtons() {
    document.querySelectorAll('[data-artwork-id]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        addToCart({
          id: btn.dataset.artworkId,
          title: btn.dataset.artworkTitle,
          price: parseFloat(btn.dataset.artworkPrice) || 0,
          image: btn.dataset.artworkImage,
          meta: btn.dataset.artworkMeta || '',
        });
      });
    });
  }

  /* ── SHOP FILTER (if present) ── */
  function initFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    const grid = document.getElementById('shop-grid');
    if (!filterBtns.length || !grid) return;
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.getAttribute('data-filter');
        grid.querySelectorAll('.product-card').forEach(card => {
          const collection = card.dataset.collection || '';
          const isAvailable = card.dataset.available === 'true';
          let show = true;
          if (filter === 'landscape') show = collection === 'landscape';
          else if (filter === 'contemporary') show = collection === 'contemporary';
          else if (filter === 'available') show = isAvailable;
          card.style.display = show ? '' : 'none';
        });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    updateCartCount();
    wireBuyButtons();
    initFilters();
    renderCartPage();
    document.getElementById('cartCheckoutBtn')?.addEventListener('click', startCheckout);
  });
})();
