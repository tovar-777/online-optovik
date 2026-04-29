/**
 * Order Modal Component
 * Handles order confirmation form, delivery schedule lookup, and order submission.
 */

import { formatPrice } from '@shared/lib/utils.js';
import { confirmOrder } from '@shared/services/orders.js';
import { sb } from '@shared/lib/supabase.js';
import { getCart, getProducts, getCartTotal, setCart, setDraftOrderId, getDraftOrderId, updateCartDisplay } from '../state/cart.js';

// ── Helpers ────────────────────────────────────────────────
function formatExactTime(timestamp) {
  const date = new Date(timestamp);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

const DAYS_SHORT = ['', '\u041f\u043d', '\u0412\u0442', '\u0421\u0440', '\u0427\u0442', '\u041f\u0442', '\u0421\u0431', '\u0412\u0441'];

function renderDeliveryDates(el, dates, isConfirm) {
  if (isConfirm && dates && dates.length > 0) {
    window._confirmedDeliveryDate = dates[0];
  }
  el.innerHTML = dates.map((date, idx) => {
    const dow = date.getDay() === 0 ? 7 : date.getDay();
    const ds = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    const isFirst = idx === 0;
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;` +
      `background:${isFirst && isConfirm ? 'rgba(232,255,71,0.2)' : 'rgba(232,255,71,0.1)'};` +
      `border:1px solid rgba(232,255,71,${isFirst && isConfirm ? '0.5' : '0.25'});` +
      `border-radius:20px;font-size:0.72rem;color:#e8ff47;` +
      `${isFirst && isConfirm ? 'font-weight:700' : ''}">` +
      `<b>${DAYS_SHORT[dow]}</b> ${ds}</span>`;
  }).join('');
}

function formatScheduleText(schedules, dirName) {
  if (!schedules || !schedules.length) return dirName || '';
  const dayNames = { 1: '\u041f\u043d', 2: '\u0412\u0442', 3: '\u0421\u0440', 4: '\u0427\u0442', 5: '\u041f\u0442', 6: '\u0421\u0431', 7: '\u0412\u0441' };
  const days = schedules
    .map(s => s.day_of_week)
    .sort((a, b) => a - b)
    .map(d => dayNames[d] || d);
  return `${dirName ? dirName + ' \u2014 ' : ''}\u0412\u044b\u0432\u043e\u0437: ${days.join(', ')}`;
}

function getNextDates(schedules, count) {
  if (!schedules || !schedules.length) return [];
  const days = schedules.map(s => s.day_of_week);
  const dates = [];
  const now = new Date();
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  for (let i = 0; i < 60 && dates.length < count; i++) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay() === 0 ? 7 : d.getDay();
    if (days.includes(dow)) dates.push(new Date(d));
  }
  return dates;
}

// ── Show Order Info Modal ──────────────────────────────────
export function showOrderInfoModal() {
  const orderInfoModal = document.querySelector('.order-info-modal');
  if (!orderInfoModal) return;
  orderInfoModal.classList.add('active');
  document.querySelector('.cart-modal')?.classList.remove('active');

  const nameEl = document.getElementById('customer-name');
  const addrEl = document.getElementById('customer-location');

  if (nameEl && !nameEl.value) {
    let name = '';
    if (window.isCodeMode && window.codeSession) name = window.codeSession.name || '';
    else if (window.currentProfile) name = window.currentProfile.name || '';
    else if (window.currentUser) name = window.currentUser.email || '';
    if (name) nameEl.value = name;
  }

  if (addrEl && !addrEl.value) {
    let addr = '';
    if (window.isCodeMode && window.codeSession) addr = window.codeSession.delivery_address || '';
    else if (window._profileAddresses && window._profileAddresses.length) {
      const sel = window._profileAddresses[window._selectedAddrIdx || 0];
      addr = typeof sel === 'string' ? sel : (sel && sel.text ? sel.text : '');
    }
    if (addr) addrEl.value = addr;
  }

  loadConfirmDelivery();

  if (addrEl) {
    addrEl._deliveryTimer = null;
    addrEl.addEventListener('input', () => {
      clearTimeout(addrEl._deliveryTimer);
      addrEl._deliveryTimer = setTimeout(loadConfirmDelivery, 700);
    });
  }
}

// ── Load Delivery Schedule for Confirm Modal ───────────────
async function loadConfirmDelivery() {
  const addrEl = document.getElementById('customer-location');
  const block = document.getElementById('confirm-delivery-block');
  const noBlock = document.getElementById('confirm-no-delivery');
  const textEl = document.getElementById('confirm-delivery-text');
  const datesEl = document.getElementById('confirm-delivery-dates');
  const selectorEl = document.getElementById('confirm-direction-selector');
  const optionsEl = document.getElementById('confirm-direction-options');
  if (!addrEl || !block) return;

  const addr = addrEl.value.trim();
  if (!addr) { block.style.display = 'none'; if (noBlock) noBlock.style.display = 'none'; return; }

  // Extract city name
  let clean = '';
  const parts = addr.split(',');
  for (const pt of parts) {
    const trimmed = pt.trim();
    if (/^(\u0433\.?\s|\u0433\u043e\u0440\u043e\u0434\s|\u0433\s)/i.test(trimmed)) {
      clean = trimmed.replace(/^(\u0433\.?\s*|\u0433\u043e\u0440\u043e\u0434\s*)/i, '').trim();
      break;
    }
  }
  if (!clean) {
    for (const pt of parts) {
      const trimmed = pt.trim();
      if (/^(\u0441\.?\s|\u043f\.?\s|\u043f\u0433\u0442\.?\s|\u0441\u0435\u043b\u043e\s|\u043f\u043e\u0441\u0451\u043a\s|\u043f\u043e\u0441\.\s)/i.test(trimmed)) {
        clean = trimmed.replace(/^(\u0441\.?\s*|\u043f\.?\s*|\u043f\u0433\u0442\.?\s*|\u0441\u0435\u043b\u043e\s*|\u043f\u043e\u0441\u0451\u043a\s*|\u043f\u043e\u0441\.\s*)/i, '').trim();
        break;
      }
    }
  }
  if (!clean && parts.length > 1) {
    clean = parts[1].trim().replace(/^(\u0433\.?\s*|\u0433\u043e\u0440\u043e\u0434\s*|\u0441\.?\s*|\u043f\.?\s*)/i, '').trim();
  }
  if (!clean) { block.style.display = 'none'; if (noBlock) noBlock.style.display = 'none'; return; }

  try {
    const locRes = await sb.from('localities').select('id,name')
      .or(`name.ilike.%${clean}%,name_alt.ilike.%${clean}%`).limit(5);
    if (locRes.error || !locRes.data?.length) {
      block.style.display = 'none'; if (noBlock) noBlock.style.display = 'flex'; return;
    }

    const localityIds = locRes.data.map(l => l.id);
    const dlRes = await sb.from('direction_localities').select('direction_id').in('locality_id', localityIds);
    if (dlRes.error || !dlRes.data?.length) {
      block.style.display = 'none'; if (noBlock) noBlock.style.display = 'flex'; return;
    }

    const dirIds = [...new Set(dlRes.data.map(d => d.direction_id))];
    const [dirRes, schedRes] = await Promise.all([
      sb.from('delivery_directions').select('id,name,depart_time').in('id', dirIds),
      sb.from('direction_schedules').select('*').in('direction_id', dirIds),
    ]);

    const dirs = dirRes.data || [];
    const scheds = schedRes.data || [];
    if (!dirs.length) { block.style.display = 'none'; if (noBlock) noBlock.style.display = 'flex'; return; }

    if (noBlock) noBlock.style.display = 'none';
    block.style.display = 'block';

    if (dirs.length === 1) {
      if (selectorEl) selectorEl.style.display = 'none';
      const s = scheds.filter(x => x.direction_id === dirs[0].id);
      textEl.innerHTML = formatScheduleText(s, dirs[0].name) || dirs[0].name;
      const dates = getNextDates(s, 5);
      window._confirmedDeliveryDate = dates[0] || null;
      renderDeliveryDates(datesEl, dates, true);
      window._selectedConfirmDirection = dirs[0].id;
    } else {
      if (selectorEl) selectorEl.style.display = 'block';
      textEl.innerHTML = '';
      datesEl.innerHTML = '';
      optionsEl.innerHTML = '';
      window._selectedConfirmDirection = null;

      dirs.forEach((dir, i) => {
        const s = scheds.filter(x => x.direction_id === dir.id);
        const dates = getNextDates(s, 3);
        const datesHtml = dates.map(d => {
          const dow = d.getDay() === 0 ? 7 : d.getDay();
          return `<b>${DAYS_SHORT[dow]}</b> ${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;
        }).join(' \u00b7 ');

        const btn = document.createElement('div');
        btn.style.cssText = 'padding:10px 13px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);cursor:pointer;font-size:0.83rem;color:rgba(255,255,255,0.8);transition:all 0.15s';
        btn.dataset.dirId = dir.id;
        btn.innerHTML = `<div style="font-weight:600;margin-bottom:3px">${dir.name}</div>` +
          `<div style="font-size:0.75rem;color:rgba(255,255,255,0.45)">${datesHtml}</div>`;

        btn.addEventListener('click', () => {
          optionsEl.querySelectorAll('div[data-dir-id]').forEach(b => {
            b.style.background = '';
            b.style.borderColor = 'rgba(255,255,255,0.15)';
            b.style.color = 'rgba(255,255,255,0.8)';
          });
          btn.style.background = 'rgba(232,255,71,0.1)';
          btn.style.borderColor = 'rgba(232,255,71,0.5)';
          btn.style.color = '#e8ff47';
          window._selectedConfirmDirection = dir.id;
          const fs = scheds.filter(x => x.direction_id === dir.id);
          textEl.innerHTML = formatScheduleText(fs, '') || '';
          const nd = getNextDates(fs, 5);
          window._confirmedDeliveryDate = nd[0] || null;
          renderDeliveryDates(datesEl, nd, true);
        });

        optionsEl.appendChild(btn);
        if (i === 0) btn.click();
      });
    }
  } catch (e) {
    console.warn('[confirmDelivery]', e.message);
    block.style.display = 'none';
  }
}

// ── Copy Order to Clipboard (guest mode) ───────────────────
export function copyOrderToClipboard() {
  const cart = getCart();
  const products = getProducts();
  if (!Object.keys(cart).length) { alert('\u041a\u043e\u0440\u0437\u0438\u043d\u0430 \u043f\u0443\u0441\u0442\u0430'); return; }

  const customerName = document.getElementById('customer-name')?.value || '\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u043e';
  const customerLocation = document.getElementById('customer-location')?.value || '\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u043e';
  const customerInfo = document.getElementById('customer-info')?.value || '\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u043e';
  const totalText = document.querySelector('.cart-floating-total')?.textContent || '0';

  let message = '';
  message += `\u0417\u0430\u043a\u0430\u0437 \u043e\u0442 ${new Date().toLocaleDateString('ru-RU')}\n\n`;
  message += `\u0418\u0442\u043e\u0433\u043e: ${totalText} \u0440\u0443\u0431.\n`;
  message += `\u0418\u043c\u044f: ${customerName}\n`;
  message += `\u041d\u0430\u0441\u0435\u043b\u0435\u043d\u043d\u044b\u0439 \u043f\u0443\u043d\u043a\u0442: ${customerLocation}\n`;
  message += `\u0414\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u0430\u044f \u0438\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0438\u044f: ${customerInfo}\n\n`;
  message += `\u0414\u0435\u0442\u0430\u043b\u0438 \u0437\u0430\u043a\u0430\u0437\u0430:\n`;
  message += `================================\n`;

  const sorted = Object.keys(cart)
    .map(pid => {
      const product = products.find(p => p.id === pid);
      return { ...product, quantity: cart[pid].quantity, timestamp: cart[pid].timestamp };
    })
    .sort((a, b) => a.order - b.order);

  sorted.forEach(item => {
    const total = item.price * item.quantity;
    const time = formatExactTime(item.timestamp);
    message += `${item.id} - ${item.cartName} - ${formatPrice(item.price)}\u20bd - ${item.quantity} ${item.unit} - ${formatPrice(total)}\u20bd [${time}]\n`;
  });

  message += `================================\n`;
  message += `\u041e\u0431\u0449\u0430\u044f \u0441\u0443\u043c\u043c\u0430: ${totalText} \u0440\u0443\u0431.\n`;
  message += `\n\u0421\u043f\u0430\u0441\u0438\u0431\u043e \u0437\u0430 \u0437\u0430\u043a\u0430\u0437!`;

  navigator.clipboard.writeText(message).then(() => {
    alert('\u0422\u0435\u043a\u0441\u0442 \u0437\u0430\u043a\u0430\u0437\u0430 \u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d. \u041f\u0435\u0440\u0435\u0439\u0434\u0438\u0442\u0435 \u0432 \u043c\u0435\u0441\u0441\u0435\u043d\u0434\u0436\u0435\u0440 \u0438 \u0432\u0441\u0442\u0430\u0432\u044c\u0442\u0435 \u0435\u0433\u043e \u0432 \u0447\u0430\u0442 \u043c\u0435\u043d\u0435\u0434\u0436\u0435\u0440\u0443.');
    document.querySelector('.order-info-modal')?.classList.remove('active');
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = message;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    alert('\u0422\u0435\u043a\u0441\u0442 \u0437\u0430\u043a\u0430\u0437\u0430 \u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d. \u041f\u0435\u0440\u0435\u0439\u0434\u0438\u0442\u0435 \u0432 \u043c\u0435\u0441\u0441\u0435\u043d\u0434\u0436\u0435\u0440 \u0438 \u0432\u0441\u0442\u0430\u0432\u044c\u0442\u0435 \u0435\u0433\u043e \u0432 \u0447\u0430\u0442 \u043c\u0435\u043d\u0435\u0434\u0436\u0435\u0440\u0443.');
    document.querySelector('.order-info-modal')?.classList.remove('active');
  });
}

// ── Submit Order (authenticated users) ─────────────────────
export async function submitOrder() {
  const cart = getCart();
  const products = getProducts();
  if (!Object.keys(cart).length) { alert('\u041a\u043e\u0440\u0437\u0438\u043d\u0430 \u043f\u0443\u0441\u0442\u0430'); return; }

  const customerName = document.getElementById('customer-name')?.value || '';
  const customerLocation = document.getElementById('customer-location')?.value || '';
  const customerInfo = document.getElementById('customer-info')?.value || '';
  const totalAmount = getCartTotal();
  const deliveryDate = window._confirmedDeliveryDate || null;

  const btn = document.getElementById('btn-confirm-order');
  if (btn) { btn.disabled = true; btn.textContent = '\u041e\u0442\u043f\u0440\u0430\u0432\u043a\u0430...'; }

  try {
    const orderId = await confirmOrder({
      cart,
      products,
      customerName,
      customerLocation,
      customerInfo,
      totalAmount,
      deliveryDate: deliveryDate ? deliveryDate.toISOString().split('T')[0] : null,
      codeSession: window.isCodeMode ? window.codeSession : null,
      currentUser: window.currentUser,
      draftOrderId: getDraftOrderId(),
    });

    console.log('[order] confirmed:', orderId);
    setDraftOrderId(null);

    // Clear cart
    setCart({});
    localStorage.removeItem('cart');
    try { localStorage.removeItem('_draftId'); } catch (e) {}

    // Show success
    document.querySelector('.order-info-modal')?.classList.remove('active');
    alert(`\u0417\u0430\u043a\u0430\u0437 #${orderId} \u0443\u0441\u043f\u0435\u0448\u043d\u043e \u043e\u0444\u043e\u0440\u043c\u043b\u0435\u043d!`);

    // Trigger display update
    updateCartDisplay();
  } catch (e) {
    console.error('[order] error:', e);
    alert('\u041e\u0448\u0438\u0431\u043a\u0430 \u043e\u0444\u043e\u0440\u043c\u043b\u0435\u043d\u0438\u044f \u0437\u0430\u043a\u0430\u0437\u0430: ' + (e.message || e));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '\u2713 \u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437'; }
  }
}

// ── Old Order Modal Handlers ───────────────────────────────
export function initOldOrderModalHandlers() {
  const modal = document.querySelector('.old-order-modal');
  if (!modal) return;

  modal.querySelector('.go-to-cart-btn')?.addEventListener('click', () => {
    modal.classList.remove('active');
    document.querySelector('.cart-modal')?.classList.add('active');
  });

  modal.querySelector('.continue-shopping-btn')?.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  modal.querySelector('.close-modal')?.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });
}

// ── Init Order Modal Listeners ─────────────────────────────
export function initOrderModalListeners() {
  // Send order buttons
  document.querySelectorAll('.send-order-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const total = getCartTotal();
      if (total === 0) { alert('\u041d\u0435\u0442 \u0437\u0430\u043a\u0430\u0437\u0430'); return; }
      if (e.target.classList.contains('disabled')) return;
      showOrderInfoModal();
    });
  });

  // Confirm button
  const confirmBtn = document.getElementById('btn-confirm-order');
  if (confirmBtn) confirmBtn.addEventListener('click', submitOrder);

  // Copy button (guests)
  const copyBtn = document.getElementById('btn-copy-only');
  if (copyBtn) copyBtn.addEventListener('click', copyOrderToClipboard);

  // Close modal buttons
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

  // Instructions modal
  document.querySelector('.how-to-order-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelector('.instructions-modal')?.classList.add('active');
  });

  initOldOrderModalHandlers();
}
