/**
 * Cart State Module
 * Manages cart state, localStorage persistence, draft auto-save, and UI updates.
 */

import { formatPrice, formatTimeAgo } from '@shared/lib/utils.js';
import { saveDraft } from '@shared/services/orders.js';

// ── Cart button SVGs ────────────────────────────────────────
const CART_SVG = {
  plus: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="#54a512" viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.13,104.13,0,0,0,128,24Zm40,112H136v32a8,8,0,0,1-16,0V136H88a8,8,0,0,1,0-16h32V88a8,8,0,0,1,16,0v32h32a8,8,0,0,1,0,16Z"></path></svg>',
  minus: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="#d32f2f" viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm40,112H88a8,8,0,0,1,0-16h80a8,8,0,0,1,0,16Z"></path></svg>',
  delete: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="#9d1531" viewBox="0 0 256 256"><path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM112,168a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm0-120H96V40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8Z"></path></svg>',
  commentEmpty: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="#666" viewBox="0 0 256 256"><path d="M138,128a10,10,0,1,1-10-10A10,10,0,0,1,138,128ZM84,118a10,10,0,1,0,10,10A10,10,0,0,0,84,118Zm88,0a10,10,0,1,0,10,10A10,10,0,0,0,172,118Zm58-54V192a14,14,0,0,1-14,14H82.23L49.07,234.64l-.06.05A13.87,13.87,0,0,1,40,238a14.11,14.11,0,0,1-5.95-1.33A13.88,13.88,0,0,1,26,224V64A14,14,0,0,1,40,50H216A14,14,0,0,1,230,64Zm-12,0a2,2,0,0,0-2-2H40a2,2,0,0,0-2,2V224a2,2,0,0,0,3.26,1.55l34.82-30.08A6,6,0,0,1,80,194H216a2,2,0,0,0,2-2Z"></path></svg>',
  commentFilled: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="#4a9eff" viewBox="0 0 256 256"><path d="M216,48H40A16,16,0,0,0,24,64V224a15.84,15.84,0,0,0,9.25,14.5A16.05,16.05,0,0,0,40,240a15.89,15.89,0,0,0,10.25-3.78l.09-.07L83,208H216a16,16,0,0,0,16-16V64A16,16,0,0,0,216,48ZM84,140a12,12,0,1,1,12-12A12,12,0,0,1,84,140Zm44,0a12,12,0,1,1,12-12A12,12,0,0,1,128,140Zm44,0a12,12,0,1,1,12-12A12,12,0,0,1,172,140Z"></path></svg>',
};

// ── State ───────────────────────────────────────────────────
let cart = {};
let products = [];
let _draftTimer = null;
let _draftOrderId = null;
let _syncHideTimer = null;
let _offlineTimer = null;

// ── Getters / Setters ───────────────────────────────────────
export function getCart() { return cart; }
export function setCart(c) { cart = c; window.cart = c; }
export function getProducts() { return products; }
export function setProducts(p) { products = p; window.products = p; }
export function getDraftOrderId() { return _draftOrderId; }
export function setDraftOrderId(id) {
  _draftOrderId = id;
  try { if (id) localStorage.setItem('_draftId', id); else localStorage.removeItem('_draftId'); } catch(e) {}
}

// ── Storage key ─────────────────────────────────────────────
export function cartStorageKey() {
  if (window.currentUser) return 'cart_' + window.currentUser.id;
  if (window.isCodeMode && window.codeSession) return 'cart_code_' + window.codeSession.id;
  try {
    const sess = JSON.parse(localStorage.getItem('_codeSession') || 'null');
    if (sess && sess.id) return 'cart_code_' + sess.id;
  } catch(e) {}
  return 'cart_guest';
}

// ── Save / Load localStorage ────────────────────────────────
export function saveCartToLocalStorage() {
  try {
    const key = cartStorageKey();
    if (!Object.keys(cart).length) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(cart));
    }
  } catch (e) {
    console.error('Cart save error:', e);
  }
}

export function loadCartFromLocalStorage() {
  try {
    const key = cartStorageKey();
    const saved = localStorage.getItem(key);
    if (!saved) return;
    const parsed = JSON.parse(saved);
    cart = {};
    Object.keys(parsed).forEach((productId) => {
      const val = parsed[productId];
      if (val && typeof val === 'object') {
        cart[productId] = val;
      } else if (val) {
        cart[productId] = { quantity: val, timestamp: new Date().toISOString() };
      }
    });
    window.cart = cart;
    console.log('[loadCart] restored', Object.keys(cart).length, 'items');
    updateCartDisplay();
  } catch (e) {
    console.error('[loadCart] error:', e);
  }
}

// ── Sync status indicator ───────────────────────────────────
export function syncStatus(state, text) {
  const el = document.getElementById('sync-indicator');
  const tx = document.getElementById('sync-text');
  const cartBtn = document.getElementById('cart-toggle-btn');

  if (cartBtn) {
    cartBtn.classList.remove('saving', 'saved-flash');
    if (state === 'saving') {
      cartBtn.classList.add('saving');
    } else if (state === 'saved') {
      cartBtn.classList.add('saved-flash');
      setTimeout(() => cartBtn?.classList.remove('saved-flash'), 700);
    }
  }
  if (!el) return;
  el.className = '';
  if (state === 'none') { el.style.display = 'none'; return; }
  el.style.display = '';
  el.className = state;
  if (tx) tx.textContent = text;
  clearTimeout(_syncHideTimer);
  if (state === 'saved') _syncHideTimer = setTimeout(() => syncStatus('none'), 3000);
}

function showOfflineToast() {
  const t = document.getElementById('offline-toast');
  if (!t) return;
  t.classList.add('visible');
  clearTimeout(_offlineTimer);
  _offlineTimer = setTimeout(() => t.classList.remove('visible'), 4500);
}

// ── Draft auto-save ─────────────────────────────────────────
async function saveDraftToSupabase() {
  if (window.isGuestMode) return;
  if (!window.currentUser && !window.isCodeMode) return;
  if (!Object.keys(cart).length) return;

  syncStatus('saving', 'сохранение…');
  try {
    const result = await saveDraft({
      cart,
      products,
      codeSession: window.isCodeMode ? window.codeSession : null,
      currentUser: window.currentUser,
      draftOrderId: _draftOrderId,
    });
    _draftOrderId = result.draftOrderId;
    setDraftOrderId(_draftOrderId);
    syncStatus('saved', 'сохранено ✓');
  } catch(e) {
    console.warn('[draft]', e.message);
    if (!navigator.onLine) { syncStatus('offline', 'нет сети'); showOfflineToast(); }
    else syncStatus('error', 'ошибка сохранения');
  }
}

export function scheduleDraftSave() {
  if (window.isGuestMode) return;
  if (!window.currentUser && !window.isCodeMode) return;
  if (window._draftRestoring) return;
  clearTimeout(_draftTimer);
  syncStatus('saving', 'изменено…');
  _draftTimer = setTimeout(saveDraftToSupabase, 5000);
}

// ── Cart operations ─────────────────────────────────────────
export function updateCart(productId, change, { onCardUpdate } = {}) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  if (!cart[productId]) {
    cart[productId] = { quantity: 0, timestamp: new Date().toISOString(), comment: '' };
  }

  const newQty = Math.max(0, Math.min(cart[productId].quantity + change, product.stock));
  cart[productId].quantity = parseFloat(newQty.toFixed(1));
  cart[productId].timestamp = new Date().toISOString();

  if (cart[productId].quantity === 0) {
    delete cart[productId];
  }

  updateCartDisplay();
  saveCartToLocalStorage();
  scheduleDraftSave();
  onCardUpdate?.(productId, product);
}

export function removeProductFromCart(productId, { onCardUpdate } = {}) {
  if (!confirm('Удалить заказ этого товара?')) return;
  delete cart[productId];
  updateCartDisplay();
  saveCartToLocalStorage();
  onCardUpdate?.(productId, products.find(p => p.id === productId));
}

export function clearCart() {
  if (!Object.keys(cart).length) { alert('Корзина уже пуста'); return; }
  if (!confirm('Вы уверены, что хотите очистить корзину?')) return;

  cart = {};
  window.cart = cart;
  updateCartDisplay();
  localStorage.removeItem(cartStorageKey());
  localStorage.removeItem('cart');
  localStorage.removeItem('lastCartNotificationTime');
  document.querySelector('.cart-modal')?.classList.remove('active');
}

// ── Cart total calculation ──────────────────────────────────
export function getCartTotal() {
  let total = 0;
  Object.keys(cart).forEach(productId => {
    const product = products.find(p => p.id === productId);
    if (product) total += product.price * cart[productId].quantity;
  });
  return total;
}

// ── Update cart display (DOM) ───────────────────────────────
export function updateCartDisplay() {
  const total = getCartTotal();

  // Update totals
  const cartModalTotal = document.querySelector('.cart-modal-total');
  const cartFloatingTotal = document.querySelector('.cart-floating-total');
  if (cartModalTotal) cartModalTotal.textContent = formatPrice(total) + ' руб.';
  if (cartFloatingTotal) cartFloatingTotal.textContent = formatPrice(total);

  // Toggle cart icons
  const cartEmpty = document.getElementById('cart-icon-empty');
  const cartFull = document.getElementById('cart-icon-full');
  if (cartEmpty && cartFull) {
    cartEmpty.style.display = total > 0 ? 'none' : '';
    cartFull.style.display = total > 0 ? '' : 'none';
  }

  // Enable/disable send order buttons
  document.querySelectorAll('.send-order-btn').forEach(btn => {
    btn.classList.toggle('disabled', total <= 0);
  });

  // Guest cart banner
  const gcb = document.getElementById('guest-cart-banner');
  if (gcb) gcb.classList.toggle('visible', !!window.isGuestMode);

  updateCartModal();
  positionFloatingButtons();
}

// ── Cart modal table ────────────────────────────────────────
export function updateCartModal() {
  const cartItems = document.querySelector('.cart-items');
  if (!cartItems) return;
  cartItems.innerHTML = '';

  const sorted = Object.keys(cart)
    .map(productId => {
      const p = products.find(x => x.id === productId);
      if (!p) return null;
      return { ...p, quantity: cart[productId].quantity, timestamp: cart[productId].timestamp, comment: cart[productId].comment || '' };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);

  sorted.forEach(item => {
    const row = document.createElement('tr');
    const total = item.price * item.quantity;

    row.innerHTML = `
      <td>${item.id}</td>
      <td>${item.cartName}</td>
      <td>${item.quantity} ${item.unit}</td>
      <td>${formatPrice(total)} ₽</td>
      <td>
        <div style="display:flex;gap:4px;justify-content:center;align-items:center;">
          <button class="cart-plus-btn" data-id="${item.id}" style="background:none;border:none;padding:0;cursor:pointer;width:26px;height:26px;display:flex;align-items:center;justify-content:center;">${CART_SVG.plus}</button>
          <button class="cart-minus-btn" data-id="${item.id}" style="background:none;border:none;padding:0;cursor:pointer;width:26px;height:26px;display:flex;align-items:center;justify-content:center;">${CART_SVG.minus}</button>
          <button class="cart-delete-btn" data-id="${item.id}" style="background:none;border:none;padding:0;cursor:pointer;width:26px;height:26px;display:flex;align-items:center;justify-content:center;">${CART_SVG.delete}</button>
          <button class="cart-comment-btn" data-id="${item.id}" style="background:none;border:none;padding:0;cursor:pointer;width:26px;height:26px;display:flex;align-items:center;justify-content:center;">${item.comment ? CART_SVG.commentFilled : CART_SVG.commentEmpty}</button>
        </div>
      </td>
      <td style="max-width:110px;vertical-align:middle">
        <div class="cart-comment-text" style="font-size:0.75rem;color:#64b4ff;font-style:italic;word-break:break-word">${item.comment || ''}</div>
        <textarea class="cart-comment-input" style="display:none;width:100%;font-size:0.72rem;background:rgba(255,255,255,0.06);border:1px solid rgba(100,180,255,0.3);border-radius:6px;color:#fff;padding:4px;resize:none;font-family:inherit" rows="2" placeholder="Комментарий...">${item.comment || ''}</textarea>
      </td>
      <td class="cart-time-cell">${formatTimeAgo(item.timestamp)}</td>
    `;

    // Event listeners
    row.querySelector('.cart-plus-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      updateCart(e.target.closest('button').dataset.id, item.multiple || 1);
    });
    row.querySelector('.cart-minus-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      updateCart(e.target.closest('button').dataset.id, -(item.multiple || 1));
    });
    row.querySelector('.cart-delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      removeProductFromCart(e.target.closest('button').dataset.id);
    });

    const commentBtn = row.querySelector('.cart-comment-btn');
    const commentInput = row.querySelector('.cart-comment-input');
    const commentText = row.querySelector('.cart-comment-text');
    if (commentBtn && commentInput) {
      commentBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const visible = commentInput.style.display !== 'none';
        commentInput.style.display = visible ? 'none' : 'block';
        commentText.style.display = visible ? 'block' : 'none';
        if (!visible) commentInput.focus();
      });
      commentInput.addEventListener('click', (e) => e.stopPropagation());
      commentInput.addEventListener('input', (e) => {
        const pid = commentBtn.dataset.id;
        const val = e.target.value;
        if (cart[pid]) {
          cart[pid].comment = val;
          commentText.textContent = val;
          commentText.style.display = val ? 'block' : 'none';
          commentBtn.innerHTML = val ? CART_SVG.commentFilled : CART_SVG.commentEmpty;
          saveCartToLocalStorage();
          scheduleDraftSave();
        }
      });
    }

    cartItems.appendChild(row);
  });
}

// ── Floating buttons position ───────────────────────────────
export function positionFloatingButtons() {
  const fb = document.querySelector('.floating-buttons');
  const bp = document.querySelector('.bottom-panel');
  if (!fb || !bp) return;
  const h = bp.getBoundingClientRect().height || bp.offsetHeight || 0;
  fb.style.bottom = (h + 10) + 'px';
}

// ── Global event listeners ──────────────────────────────────
export function initCartListeners() {
  window.addEventListener('offline', () => { syncStatus('offline', 'нет сети'); showOfflineToast(); });
  window.addEventListener('online', () => {
    const t = document.getElementById('offline-toast');
    if (t) t.classList.remove('visible');
    if (window.currentUser && !window.isGuestMode && !window.isCodeMode && Object.keys(cart).length) {
      syncStatus('saving', 'восстановление…');
      setTimeout(saveDraftToSupabase, 600);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (Object.keys(cart).length > 0) {
        try { localStorage.setItem(cartStorageKey(), JSON.stringify(cart)); } catch(e) {}
      } else {
        try { localStorage.removeItem(cartStorageKey()); } catch(e) {}
      }
    }
  });

  window.addEventListener('beforeunload', (e) => {
    if (window.isGuestMode) return;
    const isSaving = document.getElementById('cart-toggle-btn')?.classList.contains('saving')
      || _draftTimer;
    if ((window.currentUser || window.isCodeMode) && isSaving) {
      const m = 'Заказ ещё сохраняется. Подождите секунду перед закрытием.';
      e.preventDefault(); e.returnValue = m; return m;
    }
    if (!window.currentUser && !window.isCodeMode) {
      if (!Object.keys(cart).length) return;
      const m = 'В корзине есть товары.';
      e.preventDefault(); e.returnValue = m; return m;
    }
  });

  // Floating buttons resize observer
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => positionFloatingButtons());
    const bp = document.querySelector('.bottom-panel');
    if (bp) ro.observe(bp);
  }
  window.addEventListener('load', positionFloatingButtons);
  setTimeout(positionFloatingButtons, 200);
  setTimeout(positionFloatingButtons, 600);
}
