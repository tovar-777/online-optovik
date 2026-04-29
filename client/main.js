/**
 * ONLINE-ОПТОВИК — Client Application Entry Point
 *
 * Modular version of pochnorm2forcursor_v2.html.
 * Imports all components and wires up the full init flow.
 */

import { sb, sbAnon } from '@shared/lib/supabase.js';
import { formatPrice, getTimeDescription } from '@shared/lib/utils.js';
import { getCodeSession, getSession } from '@shared/services/auth.js';
import { loadAllProducts } from '@shared/services/products.js';
import { restoreCodeDraft, restoreEmailDraft } from '@shared/services/orders.js';

// ── State module ───────────────────────────────────────────
import {
  getCart, setCart, getProducts, setProducts,
  getDraftOrderId, setDraftOrderId,
  saveCartToLocalStorage, loadCartFromLocalStorage,
  updateCart, updateCartDisplay, clearCart,
  scheduleDraftSave, initCartListeners, positionFloatingButtons,
  getCartTotal,
} from './state/cart.js';

// ── Components ─────────────────────────────────────────────
import {
  makeProductsSafe, createGroupsFilter, renderProducts,
  updateBrandsFilterPanel, updateFilterButtons, updateFilterCounts,
  initCatalogListeners, enableWheelForAllLanes, BUTTON_IMAGES,
  toggleGroupFilter, toggleBrandFilter, scrollToBrand,
  getExpandedTags, setSearchQuery, getSearchQuery,
  getSelectedGroup,
} from './components/Catalog.js';

import {
  updateSplashProgress, renderSplashPreviews,
  setSplashIcons, enableWheelForSplashLists,
  initSplashListeners, enableEnterButton,
} from './components/Splash.js';

import {
  onAuthSuccess, doLogout, fetchProfile, initAuthListeners,
} from './components/AuthModal.js';

import {
  showOrderInfoModal, copyOrderToClipboard,
  initOldOrderModalHandlers, initOrderModalListeners,
} from './components/OrderModal.js';

import {
  openProfilePanel, closeProfilePanel, initProfileListeners,
} from './components/ProfilePanel.js';

import { initRegistrationListeners } from './components/Registration.js';

// ── DaData key ─────────────────────────────────────────────
window._DADATA_KEY = '0507df41b41a3993773787a692eebad5631464f5';

// ── Supabase clients on window (for legacy compat) ─────────
window._sbClient = sb;
window._sbAnon = sbAnon;

// ── Global state ───────────────────────────────────────────
window.currentUser = null;
window.currentProfile = null;
window.isGuestMode = false;
window.isCodeMode = false;
window.appDataLoaded = false;
window.codeUserName = '';
window.codeSession = null;
window.filterImages = null; // set by Catalog FILTER_IMAGES
window.buttonImages = BUTTON_IMAGES;

window.editMode = {
  active: false,
  orderId: null,
  originalUpdatedAt: null,
  originalStatus: null,
};

// ── Expose functions globally (for inline onclick, other modules) ──
window.doLogout = doLogout;
window.openProfilePanel = openProfilePanel;
window.closeProfilePanel = closeProfilePanel;
window.updateCart = updateCart;
window.clearCart = clearCart;
window.showOrderInfoModal = showOrderInfoModal;
window.copyOrderToClipboard = copyOrderToClipboard;
window.renderProducts = renderProducts;
window.toggleGroupFilter = toggleGroupFilter;
window.formatPrice = formatPrice;
// initApp will be set after function definition (hoisting doesn't apply to async)

// Guest mode helpers
window._showGuestConfirm = function () {
  const el = document.getElementById('guest-confirm-banner');
  if (el) el.style.display = 'flex';
};
window._hideGuestConfirm = function () {
  const el = document.getElementById('guest-confirm-banner');
  if (el) el.style.display = 'none';
};
window._guestExit = function () {
  window._hideGuestConfirm();
  doLogout();
};

// ── Old cart notification ──────────────────────────────────
function checkOldCartNotification() {
  const cart = getCart();
  const cartKeys = Object.keys(cart);
  if (cartKeys.length === 0) return;

  const now = Date.now();
  const lastNotificationTime = localStorage.getItem('lastCartNotificationTime');
  if (lastNotificationTime) {
    const timeDiff = now - parseInt(lastNotificationTime);
    if (timeDiff < 2 * 60 * 60 * 1000) return;
  }
  localStorage.setItem('lastCartNotificationTime', now.toString());

  const products = getProducts();
  let total = 0;
  cartKeys.forEach(productId => {
    const product = products.find(p => p.id === productId);
    if (product) total += product.price * cart[productId].quantity;
  });

  const modal = document.querySelector('.old-order-modal');
  if (!modal) return;
  const latestTimeDisplay = modal.querySelector('.latest-time-display');
  const cartItemsCount = modal.querySelector('.cart-items-count');
  const cartTotalAmount = modal.querySelector('.cart-total-amount');

  // Find latest timestamp
  let latestTimestamp = null;
  cartKeys.forEach(pid => {
    const t = cart[pid] && cart[pid].timestamp ? new Date(cart[pid].timestamp) : null;
    if (t && (!latestTimestamp || t > latestTimestamp)) latestTimestamp = t;
  });
  if (!latestTimestamp) return;

  if (latestTimeDisplay) latestTimeDisplay.textContent = getTimeDescription(latestTimestamp);
  if (cartItemsCount) cartItemsCount.textContent = cartKeys.length;
  if (cartTotalAmount) cartTotalAmount.textContent = formatPrice(total);
  modal.classList.add('active');
}

// ── Draft restore (code mode) ──────────────────────────────
async function checkAndRestoreCodeDraft(phone) {
  console.log('[codeDraft] called phone=', phone);
  window._draftRestoring = true;
  let _resolve;
  window._draftRestorePromise = new Promise(res => { _resolve = res; });
  try {
    const cachedDraftId = localStorage.getItem('_draftId') || null;
    const result = await restoreCodeDraft({
      phone,
      codeSession: window.codeSession,
      cachedDraftId,
    });
    if (!result) {
      try { localStorage.removeItem('_draftId'); } catch (e) { }
      return;
    }
    setDraftOrderId(result.draftOrderId);
    if (!result.items || !result.items.length) return;

    // Don't overwrite if user already added items
    const cart = getCart();
    if (Object.keys(cart).length > 0) {
      scheduleDraftSave();
      return;
    }

    const newCart = {};
    result.items.forEach(it => {
      if (it.product_id) newCart[it.product_id] = {
        quantity: it.quantity,
        timestamp: it.added_at || new Date().toISOString(),
        comment: it.comment || '',
      };
    });
    setCart(newCart);
    saveCartToLocalStorage();
    updateCartDisplay();
    console.log('[codeDraft] Cart restored:', Object.keys(newCart).length, 'items');
    const products = getProducts();
    if (products.length) renderProducts();
  } catch (e) {
    console.warn('[checkCodeDraft]', e.message);
  } finally {
    window._draftRestoring = false;
    if (_resolve) _resolve();
    window._draftRestorePromise = null;
  }
}

// ── Draft restore (email mode) ─────────────────────────────
async function checkAndRestoreDraft(userId) {
  if (!userId) return;
  try {
    const result = await restoreEmailDraft({ userId });
    if (!result) {
      try { localStorage.removeItem('_draftId'); } catch (e) { }
      return;
    }
    setDraftOrderId(result.draftOrderId);
    if (!result.items || !result.items.length) return;

    const cart = getCart();
    if (Object.keys(cart).length > 0) {
      scheduleDraftSave();
      return;
    }

    const newCart = {};
    result.items.forEach(it => {
      if (it.product_id) newCart[it.product_id] = {
        quantity: it.quantity,
        timestamp: it.added_at || new Date().toISOString(),
        comment: it.comment || '',
      };
    });
    setCart(newCart);
    saveCartToLocalStorage();
    updateCartDisplay();
    console.log('[draft] Cart restored:', Object.keys(newCart).length, 'items');
    const products = getProducts();
    if (products.length) renderProducts();
  } catch (e) {
    console.warn('[checkDraft]', e.message);
  }
}

// Expose draft restorers for AuthModal's onAuthSuccess
window.checkAndRestoreCodeDraft = checkAndRestoreCodeDraft;
window.checkAndRestoreDraft = checkAndRestoreDraft;

// ── Edit mode ──────────────────────────────────────────────
async function initEditMode() {
  const params = new URLSearchParams(window.location.search);
  const editOrderId = params.get('edit_order');
  const editToken = params.get('edit_token');
  if (!editOrderId || !editToken) return;

  const loadingMsg = document.querySelector('.loading-message');
  if (loadingMsg) loadingMsg.textContent = 'Загружаем заказ для редактирования…';

  try {
    const res = await sb.rpc('validate_edit_token', { p_token: editToken });
    if (res.error) throw new Error(res.error.message);
    const d = res.data;
    if (!d || !d.ok) throw new Error(d && d.error ? d.error : 'Токен недействителен или истёк');

    const orderInfo = await sb.rpc('get_order_items_for_edit', { p_order_id: editOrderId });
    const items = (orderInfo && orderInfo.data) ? orderInfo.data : [];

    window.isGuestMode = false;
    window.isCodeMode = false;
    window.editMode.active = true;
    window.editMode.orderId = editOrderId;
    window.editMode.originalUpdatedAt = d.updated_at;
    window.editMode.originalStatus = d.status;

    const splash = document.getElementById('splash-screen');
    const appContent = document.getElementById('app-content');
    if (splash) splash.style.display = 'none';
    if (appContent) appContent.classList.add('visible');

    // Wait for products then populate cart
    const waitForProducts = (cb) => {
      if (window.appDataLoaded && getProducts().length > 0) { cb(); return; }
      setTimeout(() => waitForProducts(cb), 300);
    };
    waitForProducts(() => {
      const newCart = {};
      items.forEach(it => {
        newCart[it.product_id] = { quantity: it.quantity, timestamp: it.added_at || new Date().toISOString() };
      });
      setCart(newCart);
      updateCartDisplay();
      renderProducts();
    });

    // Edit mode banner
    const banner = document.getElementById('edit-mode-banner');
    const info = document.getElementById('edit-mode-info');
    if (banner) { banner.style.display = 'flex'; document.body.style.paddingTop = '56px'; }
    if (info) info.textContent = 'Заказ #' + editOrderId.substring(0, 8).toUpperCase() +
      ' · ' + items.length + ' поз. · Изменения не сохранены до нажатия «Сохранить»';

    const saveBtn = document.getElementById('edit-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true; saveBtn.textContent = 'Проверяем…';
      try {
        const chk = await sb.from('orders').select('updated_at').eq('id', editOrderId).single();
        if (chk.error) throw chk.error;
        if (chk.data.updated_at !== window.editMode.originalUpdatedAt) {
          const proceed = confirm('Заказ был изменён после открытия редактора!\n\nИзменён: ' + new Date(chk.data.updated_at).toLocaleString('ru-RU') + '\nОткрыт:  ' + new Date(window.editMode.originalUpdatedAt).toLocaleString('ru-RU') + '\n\nВсё равно сохранить ваши изменения?');
          if (!proceed) { saveBtn.disabled = false; saveBtn.textContent = 'Сохранить изменения'; return; }
        }
        saveBtn.textContent = 'Сохраняем…';
        const products = getProducts();
        const cart = getCart();
        const newItems = Object.keys(cart).map(pid => {
          const it = cart[pid]; const p = products.find(x => x.id === pid) || {};
          const qty = it.quantity || 0; const price = parseFloat(p.price || 0);
          return {
            product_id: pid, product_name: p.cartName || p.name || pid,
            price, quantity: qty, unit: p.unit || 'шт',
            total: parseFloat((price * qty).toFixed(2)), added_at: it.timestamp || new Date().toISOString(),
            storage: p.storage || null
          };
        });
        const tot = newItems.reduce((s, i) => s + i.total, 0);
        const upd = await sb.rpc('admin_update_order', { p_order_id: editOrderId, p_items: newItems, p_total: tot });
        if (upd.error) throw upd.error;
        saveBtn.textContent = 'Сохранено!';
        if (info) info.textContent = 'Заказ #' + editOrderId.substring(0, 8).toUpperCase() + ' успешно обновлён';
        setTimeout(() => window.close(), 1500);
      } catch (e) {
        alert('Ошибка сохранения: ' + e.message);
        saveBtn.disabled = false; saveBtn.textContent = 'Сохранить изменения';
      }
    });

    const cancelBtn = document.getElementById('edit-cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', () => {
      if (confirm('Отменить редактирование? Изменения не сохранятся.')) window.close();
    });

    window.history.replaceState({}, '', window.location.pathname);

  } catch (e) {
    console.error('[editMode] error:', e.message);
    const loadingEl = document.querySelector('.loading-message');
    if (loadingEl) { loadingEl.textContent = 'Ошибка редактирования: ' + e.message; loadingEl.style.color = '#ff6b6b'; }
    const authCtrl = document.getElementById('splash-auth-controls');
    if (authCtrl) authCtrl.style.display = '';
  }
}

// ── Main init flow ─────────────────────────────────────────
async function initApp() {
  try {
    const data = await loadAllProducts({
      onProgress(percent, loaded, total) {
        updateSplashProgress(percent, loaded, total);
      },
    });
    console.log(`Loaded ${data.length} products`);

    if (data.length === 0) {
      alert('Товары не найдены!');
      document.querySelector('.loading-message')?.classList.add('hidden');
      return;
    }

    // Map products to safe format
    const products = data.map(item => {
      const safeStr = (val) => val || '';
      return {
        id: item.id,
        name: safeStr(item.name),
        price: parseFloat(safeStr(item.price).toString().replace(',', '.') || 0),
        brand: safeStr(item.brand) || 'Без бренда',
        group: safeStr(item.group),
        subgroup: safeStr(item.subgroup),
        tag: safeStr(item.tag),
        image: safeStr(item.image),
        dop: safeStr(item.dop),
        text: safeStr(item.text),
        info: safeStr(item.info),
        stock: parseFloat(item.stock) || 0,
        multiple: parseFloat(item.multiple) || 1,
        order: item.order ? parseInt(item.order) : 9999,
        cartName: safeStr(item.cartName),
        unit: safeStr(item.unit),
        storage: safeStr(item.storage),
      };
    });

    setProducts(products);

    // Render splash previews
    try {
      const promoProducts = data.filter(p => (p.dop || '').toLowerCase().includes('акция') || (p.dop || '').toLowerCase().includes('распродажа'));
      const newProducts = data.filter(p => (p.name || '').includes('🆕') || (p.dop || '').toLowerCase().includes('новин'));
      const arrivalProducts = data.filter(p => (p.dop || '').toLowerCase().includes('поступление'));
      const actualProducts = data.filter(p => (p.dop || '').includes('актуально'));
      const childProducts = data.filter(p => (p.dop || '').toLowerCase().includes('детское'));
      const discountProducts = data.filter(p => (p.dop || '').toLowerCase().includes('уценка'));
      renderSplashPreviews(promoProducts, newProducts, arrivalProducts, actualProducts, childProducts, discountProducts);
      setSplashIcons();
      setTimeout(enableWheelForSplashLists, 60);
    } catch (e) { console.warn('renderSplashPreviews failed', e); }

    // Enable enter button
    window.appDataLoaded = true;
    enableEnterButton();

    makeProductsSafe(products);
    createGroupsFilter();

    // Wait for draft restore before touching cart
    if (window._draftRestorePromise) {
      console.log('[products] Waiting for draft restore...');
      await window._draftRestorePromise;
      console.log('[products] Draft restore done');
    }

    // Load from localStorage only if cart not restored from DB
    if (!window._draftRestoring && Object.keys(getCart()).length === 0) {
      loadCartFromLocalStorage();
    }
    window._cartRestoredPendingRender = false;

    updateBrandsFilterPanel();
    updateFilterButtons();
    updateFilterCounts();
    renderProducts();
    updateCartDisplay();

    // Init all event listeners
    initCatalogListeners();
    initOldOrderModalHandlers();

    document.querySelector('.loading-message')?.classList.add('hidden');

    // Toast with product count
    setTimeout(() => {
      const el = document.createElement('div');
      el.style.cssText = 'position:fixed;top:90px;right:10px;background:#4CAF50;color:white;padding:5px 10px;border-radius:10px;font-size:12px;z-index:1000;box-shadow:0 2px 5px rgba(0,0,0,0.2)';
      el.textContent = `Товаров: ${products.length}`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 5000);
    }, 1000);

  } catch (error) {
    console.error('Load error:', error);
    let message = 'Ошибка загрузки товаров\n';
    if (error.message.includes('Failed to fetch')) {
      message += 'Проблема с интернет-соединением.\nПопробуйте открыть в Firefox или Chrome в режиме инкогнито.';
    } else if (error.message.includes('CORS')) {
      message += 'Проблема с доступом CORS.\nРазместите файл на хостинге (Vercel, Netlify) или откройте через локальный сервер.';
    } else {
      message += error.message;
    }
    alert(message);
    document.querySelector('.loading-message')?.classList.add('hidden');
  }
}

// Expose initApp for guest mode (AuthModal calls window.initApp)
window.initApp = initApp;

// ── Bootstrap ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  console.log('ONLINE-ОПТОВИК init');

  // Init splash listeners (enter button, register/login modal triggers)
  initSplashListeners();

  // Init auth listeners (code login flow, captcha, guest mode)
  initAuthListeners();

  // Init registration wizard
  initRegistrationListeners();

  // Init profile panel
  initProfileListeners();

  // Init cart event listeners (offline/online, beforeunload, resize)
  initCartListeners();

  // Init order modal listeners
  initOrderModalListeners();

  // Profile FAB
  const profileFab = document.getElementById('my-orders-fab');
  if (profileFab) profileFab.addEventListener('click', openProfilePanel);

  // Cart toggle
  const cartToggleBtn = document.getElementById('cart-toggle-btn');
  const cartModal = document.querySelector('.cart-modal');
  if (cartToggleBtn && cartModal) {
    cartToggleBtn.addEventListener('click', () => cartModal.classList.add('active'));
  }

  // Send order buttons
  document.querySelectorAll('.send-order-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const totalEl = document.querySelector('.cart-floating-total');
      const total = totalEl ? parseFloat(totalEl.textContent) : 0;
      if (total === 0) { alert('Нет заказа'); return; }
      if (e.target.classList.contains('disabled')) return;
      showOrderInfoModal();
    });
  });

  // Clear cart button
  const clearBtn = document.querySelector('.clear-btn');
  if (clearBtn) clearBtn.addEventListener('click', clearCart);

  // Copy order button (guests)
  const copyBtn = document.getElementById('btn-copy-only');
  if (copyBtn) copyBtn.addEventListener('click', copyOrderToClipboard);

  // Close modals
  document.querySelectorAll('.close-modal').forEach(closeBtn => {
    closeBtn.addEventListener('click', (e) => {
      e.target.closest('.modal')?.classList.remove('active');
    });
  });
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  });

  // "How to order?" link
  const howToOrder = document.querySelector('.how-to-order-link');
  if (howToOrder) howToOrder.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelector('.instructions-modal')?.classList.add('active');
  });

  // Main content scroll → auto-scroll groups
  const mainContent = document.querySelector('.main-content');
  if (mainContent) {
    mainContent.addEventListener('scroll', () => {
      // scrollActiveGroupIntoView is called inside Catalog module
    });
  }

  // Resize → reposition floating buttons
  window.addEventListener('resize', positionFloatingButtons);
  positionFloatingButtons();

  // Check for code session
  const codeSession = getCodeSession();
  if (codeSession) {
    window.isCodeMode = true;
    window.codeSession = codeSession;
    window.codeUserName = codeSession.name || '';
    console.log('[auth] Code session restored:', codeSession.name);

    // Show enter controls, hide auth controls
    const authCtrl = document.getElementById('splash-auth-controls');
    const enterCtrl = document.getElementById('splash-enter-controls');
    const loggedAs = document.getElementById('splash-logged-as');
    if (authCtrl) authCtrl.style.display = 'none';
    if (enterCtrl) enterCtrl.style.display = 'flex';
    if (loggedAs) {
      loggedAs.style.display = 'block';
      loggedAs.textContent = codeSession.name || 'Клиент';
    }

    // Show profile FAB
    const fab = document.getElementById('my-orders-fab');
    if (fab) fab.classList.add('visible');

    // Restore draft in background
    checkAndRestoreCodeDraft(codeSession.phone || '');
  } else {
    // Check for email auth session
    const session = await getSession();
    if (session?.user) {
      window.currentUser = session.user;
      console.log('[auth] Email session restored:', session.user.email);

      // Show enter controls
      const authCtrl = document.getElementById('splash-auth-controls');
      const enterCtrl = document.getElementById('splash-enter-controls');
      const loggedAs = document.getElementById('splash-logged-as');
      if (authCtrl) authCtrl.style.display = 'none';
      if (enterCtrl) enterCtrl.style.display = 'flex';
      if (loggedAs) {
        loggedAs.style.display = 'block';
        loggedAs.textContent = session.user.email;
      }

      // Show profile FAB
      const fab2 = document.getElementById('my-orders-fab');
      if (fab2) fab2.classList.add('visible');

      // Fetch profile and restore draft
      try {
        const profile = await fetchProfile(session.user.id);
        if (profile) window.currentProfile = profile;
      } catch (e) { console.warn('[auth] fetchProfile error:', e); }

      checkAndRestoreDraft(session.user.id);
    }
  }

  // Start loading products (runs in parallel with auth)
  initApp();

  // Edit mode (runs in parallel)
  initEditMode();
});
