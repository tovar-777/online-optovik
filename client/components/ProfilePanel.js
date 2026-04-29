/**
 * Profile Panel Component
 * Side panel with sub-panels: orders, client data, addresses, questions, delivery info.
 */

import { sb } from '@shared/lib/supabase.js';
import { escHtml, $ } from '@shared/lib/utils.js';

// ── State ──────────────────────────────────────────────────
let _ordersCache = null;
let _profileAddresses = [];
let _selectedAddrIdx = 0;
let _dadataTimer = null;

// ── Open / Close ───────────────────────────────────────────
export function openProfilePanel() {
  const overlay = document.getElementById('profile-overlay');
  const panel = document.getElementById('profile-panel');
  if (!overlay || !panel) return;
  _profileUpdateHeader();
  overlay.classList.add('active');
  panel.classList.add('active');
  document.querySelectorAll('.profile-subpanel').forEach(sp => sp.classList.remove('active'));
  if (window.currentUser || window.isCodeMode) _profileLoadAddressPreview();
  _ordersCache = null;
  if (window.isCodeMode && window.codeSession) _profileLoadClientInfo();
}

export function closeProfilePanel() {
  const overlay = document.getElementById('profile-overlay');
  const panel = document.getElementById('profile-panel');
  if (overlay) overlay.classList.remove('active');
  if (panel) panel.classList.remove('active');
}

// ── Client info (via RPC) ──────────────────────────────────
async function _profileLoadClientInfo() {
  const el = document.getElementById('pf-client-info');
  if (!el) return;
  const sess = window.codeSession;
  if (!sess || !sess.id) { el.innerHTML = '<div class="pci-empty">Нет данных</div>'; return; }
  el.innerHTML = '<div class="pci-loading">⏳ Загрузка…</div>';
  try {
    const { data, error } = await sb.rpc('get_client_profile', { p_client_id: sess.id });
    if (error) throw error;
    const d = data || {};
    const rows = [];
    if (d.admin_alias)       rows.push(['Псевдоним',      d.admin_alias]);
    rows.push(['Тип', d.type === 'legal' ? 'Юр. лицо / ИП' : 'Физлицо']);
    if (d.phone && d.phone !== 'не указан') rows.push(['Телефон', d.phone]);
    if (d.email)             rows.push(['Email',           d.email]);
    if (d.delivery_address)  rows.push(['Адрес доставки',  d.delivery_address]);
    if (d.doc_type)          rows.push(['Документ',        d.doc_type]);
    if (d.company_full_name) rows.push(['Организация',     d.company_full_name]);
    if (d.inn)               rows.push(['ИНН',             d.inn]);
    if (d.ogrn)              rows.push(['ОГРН',            d.ogrn]);
    if (d.kpp)               rows.push(['КПП',             d.kpp]);
    if (d.director_name)     rows.push(['Руководитель',    d.director_name]);
    if (d.legal_address)     rows.push(['Юр. адрес',       d.legal_address]);
    if (!rows.length) { el.innerHTML = '<div class="pci-empty">Данные не заполнены</div>'; return; }
    el.innerHTML = rows.map(r =>
      '<div class="pci-row"><span class="pci-label">' + r[0] + '</span><span class="pci-value">' + r[1] + '</span></div>'
    ).join('');
  } catch (e) {
    console.error('Client info error:', e);
    el.innerHTML = '<div class="pci-empty">Ошибка загрузки</div>';
  }
}

// ── Orders ─────────────────────────────────────────────────
async function _profileLoadOrders() {
  const listEl = document.getElementById('orders-list-content');
  if (!listEl) return;
  if (_ordersCache) { _renderOrdersHierarchy(_ordersCache); return; }
  listEl.innerHTML = '<div class="orders-empty"><div class="orders-empty-icon">⏳</div>Загружаем…</div>';
  try {
    const clientId = (window.isCodeMode && window.codeSession) ? window.codeSession.id
      : (window.currentUser ? window.currentUser.id : null);
    if (!clientId) {
      listEl.innerHTML = '<div class="orders-empty">Войдите, чтобы видеть заказы</div>';
      return;
    }
    const { data, error } = await sb.rpc('get_client_orders', { p_client_id: clientId });
    if (error) throw error;
    const orders = (data && data.orders) ? data.orders : [];
    const items = (data && data.items) ? data.items : [];
    if (!orders.length) {
      listEl.innerHTML = '<div class="orders-empty"><div class="orders-empty-icon">📦</div>Заказов пока нет</div>';
      return;
    }
    const itemsMap = {};
    items.forEach(it => {
      if (!itemsMap[it.order_id]) itemsMap[it.order_id] = [];
      itemsMap[it.order_id].push(it);
    });
    orders.forEach(o => { o._items = itemsMap[o.id] || []; });
    _ordersCache = orders;
    _renderOrdersHierarchy(orders);
    _initOrdersCalendar(orders);
  } catch (e) {
    console.error('Orders error:', e);
    if (listEl) listEl.innerHTML = '<div class="orders-empty">Ошибка загрузки</div>';
  }
}

const STATUS_COLORS = {
  'new': '#64b5f6', 'подтверждён': '#81c784', 'в маршруте': '#ffb74d',
  'отгружен': '#4db6ac', 'доставлен': '#a5d6a7', 'отменён': '#ef9a9a'
};

function _renderOrdersHierarchy(orders) {
  const listEl = document.getElementById('orders-list-content');
  if (!listEl) return;
  if (!orders || !orders.length) {
    listEl.innerHTML = '<div class="orders-empty"><div class="orders-empty-icon">📦</div>Заказов пока нет</div>';
    return;
  }

  // Group by month → day → orders
  const byMonth = {};
  orders.forEach(o => {
    const d = new Date(o.created_at);
    const mKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const dKey = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    if (!byMonth[mKey]) byMonth[mKey] = { label: d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }), days: {} };
    if (!byMonth[mKey].days[dKey]) byMonth[mKey].days[dKey] = [];
    byMonth[mKey].days[dKey].push(o);
  });

  let html = '';
  Object.keys(byMonth).sort().reverse().forEach((mKey, mIdx) => {
    const month = byMonth[mKey];
    const mOpen = mIdx === 0;
    const mId = 'pm-' + mKey;
    let mTotal = 0;
    Object.values(month.days).forEach(ds => ds.forEach(o => { mTotal += parseFloat(o.total_amount || 0); }));

    html += '<div class="pord-month">'
      + '<div class="pord-month-hdr pord-toggle" data-pord="' + mId + '">'
      + '<span class="pord-arrow" id="arr-' + mId + '">' + (mOpen ? '▼' : '▶') + '</span>'
      + '<span class="pord-month-name">' + _cap(month.label) + '</span>'
      + '<span class="pord-month-sum">' + Math.round(mTotal).toLocaleString('ru-RU') + ' ₽</span>'
      + '</div>'
      + '<div id="' + mId + '" style="display:' + (mOpen ? 'block' : 'none') + '">';

    Object.keys(month.days).sort().reverse().forEach((dKey, dIdx) => {
      const dayOrders = month.days[dKey];
      const dId = 'pd-' + mKey + '-' + dKey.replace(/[./]/g, '');
      const dOpen = mOpen && dIdx === 0;
      const dTotal = dayOrders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);

      html += '<div class="pord-day">'
        + '<div class="pord-day-hdr pord-toggle" data-pord="' + dId + '">'
        + '<span class="pord-arrow" id="arr-' + dId + '">' + (dOpen ? '▼' : '▶') + '</span>'
        + '<span class="pord-day-name">' + dKey + '</span>'
        + '<span class="pord-day-meta">' + dayOrders.length + ' зак. · ' + Math.round(dTotal).toLocaleString('ru-RU') + ' ₽</span>'
        + '</div>'
        + '<div id="' + dId + '" style="display:' + (dOpen ? 'block' : 'none') + '">';

      dayOrders.forEach(o => {
        const color = STATUS_COLORS[o.status] || '#aaa';
        const timeStr = new Date(o.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const delStr = o.delivery_date ? ' · 🚚 ' + new Date(o.delivery_date + 'T00:00:00').toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : '';
        const oId = 'po-' + o.id;
        const amt = Math.round(parseFloat(o.total_amount || 0)).toLocaleString('ru-RU');

        html += '<div class="pord-order">'
          + '<div class="pord-order-hdr pord-toggle" data-pord="' + oId + '">'
          + '<span class="pord-arrow" id="arr-' + oId + '">▶</span>'
          + '<span class="pord-order-time">' + timeStr + delStr + '</span>'
          + '<span class="pord-status" style="background:' + color + '22;color:' + color + ';border-color:' + color + '44">' + (o.status || '—') + '</span>'
          + '<span class="pord-order-sum">' + amt + ' ₽</span>'
          + '</div>'
          + '<div id="' + oId + '" style="display:none">'
          + _renderOrderItems(o._items)
          + '</div>'
          + '</div>';
      });

      html += '</div></div>';
    });

    html += '</div></div>';
  });

  listEl.innerHTML = html;
  listEl.addEventListener('click', e => {
    const hdr = e.target.closest('.pord-toggle');
    if (!hdr) return;
    _togglePord(hdr.dataset.pord);
  });
}

function _renderOrderItems(items) {
  if (!items || !items.length) return '<div style="padding:6px 8px;font-size:0.75rem;color:rgba(255,255,255,0.3)">Нет позиций</div>';
  let html = '<table style="width:100%;border-collapse:collapse;font-size:0.74rem;margin:4px 0 4px 16px">' +
    '<thead><tr>' +
    '<th style="text-align:left;padding:3px 4px;color:rgba(255,255,255,0.3);font-weight:500">Товар</th>' +
    '<th style="text-align:right;padding:3px 4px;color:rgba(255,255,255,0.3);font-weight:500;white-space:nowrap">Кол-во</th>' +
    '<th style="text-align:right;padding:3px 4px;color:rgba(255,255,255,0.3);font-weight:500;white-space:nowrap">Сумма</th>' +
    '</tr></thead><tbody>';
  items.forEach(it => {
    html += '<tr style="border-top:1px solid rgba(255,255,255,0.04)">' +
      '<td style="padding:4px 4px;color:rgba(255,255,255,0.75);line-height:1.3">' + escHtml(it.product_name) + '</td>' +
      '<td style="padding:4px 4px;text-align:right;color:rgba(255,255,255,0.55);white-space:nowrap">' + it.quantity + ' ' + it.unit + '</td>' +
      '<td style="padding:4px 4px;text-align:right;color:#e8ff47;white-space:nowrap;font-weight:600">' + Math.round(parseFloat(it.total || 0)).toLocaleString('ru-RU') + '</td>' +
      '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

function _togglePord(id) {
  const el = document.getElementById(id);
  const arr = document.getElementById('arr-' + id);
  if (!el) return;
  const isOpen = el.style.display !== 'none';
  el.style.display = isOpen ? 'none' : 'block';
  if (arr) arr.textContent = isOpen ? '▶' : '▼';
}

function _cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

// ── Orders calendar ────────────────────────────────────────
function _initOrdersCalendar(orders) {
  const btn = document.getElementById('pf-orders-cal-btn');
  if (!btn) return;
  const orderDates = {};
  orders.forEach(o => {
    const d = new Date(o.created_at);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    if (!orderDates[key]) orderDates[key] = 0;
    orderDates[key]++;
  });

  btn.onclick = function (e) {
    e.stopPropagation();
    const popup = document.getElementById('pf-orders-cal-popup');
    if (!popup) return;
    if (popup.style.display !== 'none') { popup.style.display = 'none'; return; }
    const now = new Date();
    popup.innerHTML = _buildCalendar(now.getFullYear(), now.getMonth(), orderDates);
    popup.style.display = 'block';
    const btnRect = btn.getBoundingClientRect();
    const panelEl = document.getElementById('pf-sub-orders');
    const panelRect = panelEl ? panelEl.getBoundingClientRect() : { top: 0, left: 0 };
    popup.style.top = (btnRect.bottom - panelRect.top + 4) + 'px';
    popup.style.right = (panelRect.right - btnRect.right) + 'px';
    popup.style.left = 'auto';
    setTimeout(() => {
      document.addEventListener('click', function _cc(ev) {
        if (!popup.contains(ev.target) && ev.target !== btn) {
          popup.style.display = 'none';
          document.removeEventListener('click', _cc);
        }
      });
    }, 50);
  };
}

function _buildCalendar(year, month, orderDates) {
  const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const today = new Date();

  let html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">' +
    '<button onclick="window._calNav(-1)" style="background:none;border:none;color:rgba(255,255,255,0.5);cursor:pointer;font-size:1.1rem;padding:2px 6px">‹</button>' +
    '<span style="font-size:0.85rem;font-weight:700;color:#e8ff47" id="cal-title">' + months[month] + ' ' + year + '</span>' +
    '<button onclick="window._calNav(1)" style="background:none;border:none;color:rgba(255,255,255,0.5);cursor:pointer;font-size:1.1rem;padding:2px 6px">›</button>' +
    '</div>';

  html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center">';
  days.forEach(d => { html += '<div style="font-size:0.65rem;color:rgba(255,255,255,0.3);padding-bottom:4px">' + d + '</div>'; });

  let firstDay = new Date(year, month, 1).getDay();
  firstDay = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) html += '<div></div>';
  for (let day = 1; day <= daysInMonth; day++) {
    const key = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    const hasOrder = orderDates[key];
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
    let style = 'font-size:0.78rem;padding:4px 2px;border-radius:6px;cursor:default;position:relative;';
    if (isToday) style += 'border:1px solid rgba(232,255,71,0.4);color:#e8ff47;';
    else style += 'color:rgba(255,255,255,' + (hasOrder ? '0.9' : '0.3') + ');';
    if (hasOrder) style += 'background:rgba(129,194,132,0.18);font-weight:700;';
    html += '<div style="' + style + '">' + day;
    if (hasOrder) html += '<span style="position:absolute;bottom:1px;right:2px;font-size:0.52rem;color:#81c784">' + orderDates[key] + '</span>';
    html += '</div>';
  }
  html += '</div>';
  return html;
}

// Calendar navigation — exposed as window global for inline onclick
window._calNav = function (dir) {
  const title = document.getElementById('cal-title');
  if (!title) return;
  const parts = title.textContent.split(' ');
  const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  let m = months.indexOf(parts[0]);
  let y = parseInt(parts[1]);
  m += dir;
  if (m < 0) { m = 11; y--; }
  if (m > 11) { m = 0; y++; }
  const popup = document.getElementById('pf-orders-cal-popup');
  const dates = {};
  if (_ordersCache) {
    _ordersCache.forEach(o => {
      const d = new Date(o.created_at);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      dates[key] = (dates[key] || 0) + 1;
    });
  }
  if (popup) popup.innerHTML = _buildCalendar(y, m, dates);
};

// ── Sub-panel navigation ───────────────────────────────────
function _profileOpenSub(id) {
  document.querySelectorAll('.profile-subpanel').forEach(sp => sp.classList.remove('active'));
  const sub = document.getElementById(id);
  if (sub) sub.classList.add('active');
  if (id === 'pf-sub-orders') _profileLoadOrders();
  if (id === 'pf-sub-clientdata' && window.isCodeMode && window.codeSession) _profileLoadClientInfo();
}

// ── Profile header ─────────────────────────────────────────
function _profileUpdateHeader() {
  const avatarEl = document.getElementById('profile-avatar-el');
  const nameEl = document.getElementById('profile-name-el');
  const subEl = document.getElementById('profile-sub-el');
  const badgeEl = document.getElementById('profile-mode-badge');
  let name, sub, badgeClass, badgeText;
  if (window.isGuestMode) {
    name = 'Гость';
    sub = 'Деморежим'; badgeClass = 'guest'; badgeText = 'Гостевой доступ';
    const geb = document.getElementById('guest-exit-btn');
    if (geb) geb.style.display = 'flex';
  } else if (window.isCodeMode) {
    name = window.codeUserName || 'Клиент';
    sub = ''; badgeClass = 'code'; badgeText = '';
  } else if (window.currentUser) {
    name = (window.currentProfile && window.currentProfile.name) || window.currentUser.email || 'Пользователь';
    sub = window.currentUser.email || '';
    badgeClass = 'email'; badgeText = 'Авторизован';
  } else {
    name = 'Профиль'; sub = ''; badgeClass = ''; badgeText = '';
  }
  if (avatarEl) avatarEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="#e7f708" viewBox="0 0 256 256"><path d="M198.13,194.85A8,8,0,0,1,192,208H24a8,8,0,0,1-6.12-13.15c14.94-17.78,33.52-30.41,54.17-37.17a68,68,0,1,1,71.9,0C164.6,164.44,183.18,177.07,198.13,194.85ZM255.18,154a8,8,0,0,1-6.94,4,7.92,7.92,0,0,1-4-1.07l-4.67-2.7a23.92,23.92,0,0,1-7.58,4.39V164a8,8,0,0,1-16,0v-5.38a23.92,23.92,0,0,1-7.58-4.39l-4.67,2.7a7.92,7.92,0,0,1-4,1.07,8,8,0,0,1-4-14.93l4.66-2.69a23.6,23.6,0,0,1,0-8.76l-4.66-2.69a8,8,0,1,1,8-13.86l4.67,2.7a23.92,23.92,0,0,1,7.58-4.39V108a8,8,0,0,1,16,0v5.38a23.92,23.92,0,0,1,7.58,4.39l4.67-2.7a8,8,0,1,1,8,13.86l-4.66,2.69a23.6,23.6,0,0,1,0,8.76l4.66,2.69A8,8,0,0,1,255.18,154ZM224,144a8,8,0,1,0-8-8A8,8,0,0,0,224,144Z"></path></svg>';
  if (nameEl) nameEl.textContent = name;
  if (subEl) subEl.textContent = sub;
  if (badgeEl) { badgeEl.className = 'profile-mode-badge ' + badgeClass; badgeEl.textContent = badgeText; }
  const prev = document.getElementById('pf-name-preview');
  if (prev) prev.textContent = name;
}

// ── Addresses ──────────────────────────────────────────────
async function _profileLoadAddresses() {
  if (window.isCodeMode && window.codeSession) {
    const addr = window.codeSession.delivery_address;
    _profileAddresses = addr ? [addr] : [];
    _selectedAddrIdx = 0;
    _profileRenderAddresses();
    _profileUpdatePreview();
    return;
  }
  if (!window.currentUser) return;
  try {
    const res = await sb.from('user_profiles').select('delivery_addresses, selected_address_idx')
      .eq('user_id', window.currentUser.id).maybeSingle();
    const raw = res.data && res.data.delivery_addresses;
    _profileAddresses = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    const si = res.data && res.data.selected_address_idx;
    _selectedAddrIdx = (typeof si === 'number' && si < _profileAddresses.length) ? si : 0;
  } catch (e) { _profileAddresses = []; }
}

async function _profileLoadAddressPreview() {
  await _profileLoadAddresses();
  _profileUpdatePreview();
}

function _profileRenderAddresses() {
  const list = document.getElementById('pf-addr-list');
  if (!list) return;
  if (!_profileAddresses.length) {
    list.innerHTML = '<div style="font-size:0.8rem;color:rgba(255,255,255,0.3);margin-bottom:12px">Адреса не добавлены</div>';
    _profileUpdatePreview();
    return;
  }
  list.innerHTML = _profileAddresses.map((addr, i) => {
    const isSel = (i === _selectedAddrIdx);
    return '<div class="addr-card' + (isSel ? ' addr-card-active' : '') + '" '
      + 'onclick="window._profileSelectAddr(' + i + ')" style="cursor:pointer">'
      + (isSel ? '<div class="addr-card-badge">Доставка</div>' : '')
      + '<div class="addr-card-text">' + escHtml(addr) + '</div>'
      + '<button class="addr-card-del" onclick="event.stopPropagation();window._profileDelAddr(' + i + ')" title="Удалить">×</button>'
      + '</div>';
  }).join('');
  _profileUpdatePreview();
}

window._profileSelectAddr = async function (i) {
  _selectedAddrIdx = i;
  await _profileSaveAddresses();
  _profileRenderAddresses();
};

function _profileUpdatePreview() {
  const prev = document.getElementById('pf-addr-preview');
  if (!prev) return;
  if (!_profileAddresses.length) { prev.textContent = 'не указаны'; return; }
  const count = _profileAddresses.length;
  const sel = _profileAddresses[_selectedAddrIdx] || _profileAddresses[0];
  prev.innerHTML = '<span style="color:#e8ff47">' + count + ' адр.</span>'
    + '<br><span style="font-size:0.72rem;opacity:0.75;white-space:normal;line-height:1.3">' + escHtml(sel) + '</span>';
}

window._profileDelAddr = async function (idx) {
  const addr = _profileAddresses[idx] || '';
  const short = addr.length > 45 ? addr.slice(0, 45) + '…' : addr;
  if (!confirm('Удалить адрес?\n' + short)) return;
  _profileAddresses.splice(idx, 1);
  if (_selectedAddrIdx >= _profileAddresses.length) _selectedAddrIdx = Math.max(0, _profileAddresses.length - 1);
  await _profileSaveAddresses();
  _profileRenderAddresses();
};

async function _profileSaveAddresses() {
  if (!window.currentUser) return;
  await sb.from('user_profiles').update({
    delivery_addresses: _profileAddresses,
    selected_address_idx: _selectedAddrIdx
  }).eq('user_id', window.currentUser.id);
}

// ── DaData for profile address fields ──────────────────────
function _dadataQuery(fieldType, query, cityHint, dropId, onSelect) {
  const inputMap = {
    'pf-dadata-city-drop': 'pf-addr-city',
    'pf-dadata-street-drop': 'pf-addr-street',
    'pf-dadata-house-drop': 'pf-addr-house',
  };
  const inputEl = document.getElementById(inputMap[dropId] || dropId);
  if (!query || query.length < 2) { _dadataHideDrop(dropId); return; }
  clearTimeout(_dadataTimer);
  _dadataTimer = setTimeout(async () => {
    try {
      const bodyObj = { query, count: 8 };
      if (fieldType === 'city') {
        bodyObj.from_bound = { value: 'city' };
        bodyObj.to_bound = { value: 'settlement' };
        bodyObj.locations = [{ region: 'Приморский' }];
        bodyObj.count = 12;
      } else if (fieldType === 'street' || fieldType === 'house') {
        bodyObj.from_bound = { value: fieldType };
        bodyObj.to_bound = { value: fieldType };
        if (cityHint) {
          const hint = (typeof cityHint === 'object') ? cityHint : { text: cityHint };
          if (hint.settlFias) {
            bodyObj.locations = [{ settlement_fias_id: hint.settlFias }];
          } else if (hint.cityFias) {
            bodyObj.locations = [{ city_fias_id: hint.cityFias }];
          } else {
            const txt = (hint.text || '').replace(/^(г\.|с\.|п\.|пгт\.|пос\.|деревня\s|село\s|город\s)/i, '').replace(/\s*\([^)]*\)/g, '').trim();
            bodyObj.locations = txt
              ? [{ region: 'Приморский', city: txt }, { region: 'Приморский', settlement: txt }]
              : [{ region: 'Приморский' }];
          }
        } else {
          bodyObj.locations = [{ region: 'Приморский' }];
        }
      }
      const resp = await fetch(
        'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address',
        {
          method: 'POST', mode: 'cors',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': 'Token ' + window._DADATA_KEY },
          body: JSON.stringify(bodyObj)
        }
      );
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      let sugg = data.suggestions || [];
      if (!sugg.length) { _dadataHideDrop(dropId); return; }

      // City: filter irrelevant + disambiguate duplicates
      if (fieldType === 'city') {
        const queryLower = query.toLowerCase().trim();
        sugg = sugg.filter(s => {
          const d = s.data || {};
          const cityName = (d.city || '').toLowerCase();
          const settlName = (d.settlement || '').toLowerCase();
          const minQ = queryLower.length >= 3 ? queryLower.slice(0, 3) : queryLower;
          return cityName.indexOf(minQ) !== -1 || settlName.indexOf(minQ) !== -1;
        });
        sugg.forEach(s => {
          const d = s.data || {};
          const hasSettl = !!(d.settlement || d.settlement_with_type);
          const primary = hasSettl
            ? (d.settlement_with_type || d.settlement)
            : (d.city_with_type || d.city || s.value);
          const secondary = hasSettl
            ? (d.city_with_type || d.city_district_with_type || d.area_with_type || '')
            : (d.area_with_type || '');
          s._primary = primary;
          s._secondary = secondary;
          s._base = (hasSettl ? (d.settlement || '') : (d.city || '')).toLowerCase();
        });
        const nameCount = {};
        sugg.forEach(s => { nameCount[s._base] = (nameCount[s._base] || 0) + 1; });
        sugg.forEach(s => {
          const needDisambig = nameCount[s._base] > 1 && s._secondary
            && s._secondary.toLowerCase() !== s._primary.toLowerCase();
          s._label = needDisambig ? s._primary + ' (' + s._secondary + ')' : s._primary;
        });
      }

      // Deduplicate by label
      const seen = {};
      sugg = sugg.filter(s => {
        const d = s.data || {};
        let label;
        if (fieldType === 'city') {
          label = s._label || d.city_with_type || d.settlement_with_type || d.city || d.settlement || s.value;
        } else if (fieldType === 'street') {
          label = d.street_with_type || d.street || s.value;
        } else {
          label = d.house ? (d.street_with_type ? d.street_with_type + ', д. ' + d.house + (d.flat ? ', кв. ' + d.flat : '') : 'д. ' + d.house) : s.value;
        }
        if (!label) label = s.value;
        s._label = label;
        if (seen[label]) return false;
        seen[label] = true;
        return true;
      });
      if (!sugg.length) { _dadataHideDrop(dropId); return; }
      _dadataShowDrop(dropId, inputEl, sugg, fieldType, onSelect);
    } catch (e) {
      console.error('[dadata] error:', e);
      _dadataHideDrop(dropId);
    }
  }, 400);
}

function _dadataShowDrop(dropId, inputEl, sugg, fieldType, onSelect) {
  const old = document.getElementById('dadata-float-' + dropId);
  if (old) old.remove();
  const drop = document.createElement('div');
  drop.id = 'dadata-float-' + dropId;
  drop.className = 'dadata-dropdown';
  drop.style.cssText = 'position:fixed;z-index:999999;min-width:260px;max-width:340px;display:block;';
  drop.innerHTML = sugg.map(s => {
    const d = s.data || {};
    const label = s._label || s.value;
    return '<div class="dadata-item"'
      + ' data-value="' + escHtml(label) + '"'
      + ' data-normalized="' + escHtml(s.value) + '"'
      + ' data-city-fias="' + escHtml(d.city_fias_id || '') + '"'
      + ' data-settl-fias="' + escHtml(d.settlement_fias_id || '') + '"'
      + '>' + escHtml(label) + '</div>';
  }).join('');
  document.body.appendChild(drop);
  if (inputEl) {
    const r = inputEl.getBoundingClientRect();
    drop.style.top = (r.bottom + 4) + 'px';
    drop.style.left = r.left + 'px';
    drop.style.width = r.width + 'px';
  }
  drop.querySelectorAll('.dadata-item').forEach(item => {
    item.addEventListener('mousedown', function (e) {
      e.preventDefault();
      _dadataHideDrop(dropId);
      onSelect(this.dataset.value, this.dataset.normalized, this.dataset.cityFias, this.dataset.settlFias);
    });
  });
  setTimeout(() => {
    document.addEventListener('click', function _hide(e) {
      if (!drop.contains(e.target)) { _dadataHideDrop(dropId); document.removeEventListener('click', _hide); }
    });
  }, 0);
}

function _dadataHideDrop(dropId) {
  const el = document.getElementById('dadata-float-' + dropId);
  if (el) el.remove();
}

// ── Name save ──────────────────────────────────────────────
async function _profileSaveName() {
  const inp = document.getElementById('pf-name-input');
  const msg = document.getElementById('pf-name-msg');
  const btn = document.getElementById('pf-name-save');
  if (!inp || !window.currentUser) return;
  const val = inp.value.trim();
  if (!val) { if (msg) { msg.className = 'pf-msg err'; msg.textContent = 'Введите имя'; } return; }
  if (btn) btn.disabled = true;
  try {
    await sb.from('user_profiles').update({ name: val }).eq('user_id', window.currentUser.id);
    if (window.currentProfile) window.currentProfile.name = val;
    _profileUpdateHeader();
    if (msg) { msg.className = 'pf-msg ok'; msg.textContent = 'Сохранено ✓'; }
    setTimeout(() => { if (msg) msg.textContent = ''; }, 2500);
  } catch (e) {
    if (msg) { msg.className = 'pf-msg err'; msg.textContent = 'Ошибка: ' + e.message; }
  }
  if (btn) btn.disabled = false;
}

// ── Question send ──────────────────────────────────────────
async function _profileSendQuestion() {
  const txt = document.getElementById('pf-question-text');
  const msg = document.getElementById('pf-question-msg');
  const btn = document.getElementById('pf-question-send');
  if (!txt) return;
  const val = txt.value.trim();
  if (!val) { if (msg) { msg.className = 'pf-msg err'; msg.textContent = 'Напишите вопрос'; } return; }
  if (btn) btn.disabled = true;
  try {
    const authorName = (window.currentProfile && window.currentProfile.name)
      || (window.currentUser && window.currentUser.email)
      || window.codeUserName || 'Гость';
    await sb.from('client_questions').insert({
      user_id: window.currentUser ? window.currentUser.id : null,
      user_name: authorName,
      question: val,
      status: 'new'
    });
    txt.value = '';
    if (msg) { msg.className = 'pf-msg ok'; msg.textContent = 'Вопрос отправлен. Менеджер свяжется с вами. ✓'; }
  } catch (e) {
    if (msg) { msg.className = 'pf-msg err'; msg.textContent = 'Ошибка: ' + e.message; }
  }
  if (btn) btn.disabled = false;
}

// ── Delivery schedule helpers ──────────────────────────────
function _getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function _getNextDates(schedules, count) {
  count = count || 5;
  const results = [];
  const d = new Date();
  let tries = 0;
  while (results.length < count && tries < 90) {
    d.setDate(d.getDate() + 1);
    tries++;
    const dow = d.getDay() === 0 ? 7 : d.getDay();
    const weekNum = _getISOWeek(d);
    const isEven = weekNum % 2 === 0;
    const match = schedules.find(s => {
      if (s.day_of_week !== dow) return false;
      if (s.week_parity === 'any') return true;
      if (s.week_parity === 'even' && isEven) return true;
      if (s.week_parity === 'odd' && !isEven) return true;
      return false;
    });
    if (match) results.push(new Date(d));
  }
  return results;
}

function _formatScheduleText(schedules, dirName) {
  const DAYS = ['', 'понедельникам', 'вторникам', 'средам', 'четвергам', 'пятницам', 'субботам', 'воскресеньям'];
  if (!schedules || !schedules.length) return '';
  const parity = schedules[0].week_parity;
  const days = schedules
    .sort((a, b) => a.day_of_week - b.day_of_week)
    .map(s => DAYS[s.day_of_week]);
  const daysStr = days.length === 1 ? 'по ' + days[0]
    : 'по ' + days.slice(0, -1).join(', ') + ' и ' + days[days.length - 1];
  const freqStr = parity === 'even' ? ' (чётные недели)' :
    parity === 'odd' ? ' (нечётные недели)' : '';
  return 'Вывоз ' + daysStr + freqStr;
}

function _renderDeliveryDates(el, dates, isConfirm) {
  const DAYS_SHORT = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  if (isConfirm && dates && dates.length > 0) {
    window._confirmedDeliveryDate = dates[0];
  }
  el.innerHTML = dates.map((date, idx) => {
    const dow = date.getDay() === 0 ? 7 : date.getDay();
    const ds = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    const isFirst = idx === 0;
    return '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;' +
      'background:' + (isFirst && isConfirm ? 'rgba(232,255,71,0.2)' : 'rgba(232,255,71,0.1)') + ';' +
      'border:1px solid rgba(232,255,71,' + (isFirst && isConfirm ? '0.5' : '0.25') + ');' +
      'border-radius:20px;font-size:0.72rem;color:#e8ff47;' +
      (isFirst && isConfirm ? 'font-weight:700' : '') + '">' +
      '<b>' + DAYS_SHORT[dow] + '</b> ' + ds + '</span>';
  }).join('');
}

// ── Delivery info for confirm modal ────────────────────────
export async function loadConfirmDelivery() {
  const addrEl = document.getElementById('customer-location');
  const block = document.getElementById('confirm-delivery-block');
  const noBlock = document.getElementById('confirm-no-delivery');
  const textEl = document.getElementById('confirm-delivery-text');
  const datesEl = document.getElementById('confirm-delivery-dates');
  const selectorEl = document.getElementById('confirm-direction-selector');
  const optionsEl = document.getElementById('confirm-direction-options');
  if (!addrEl || !block) return;

  const addr = addrEl.value.trim();
  if (!addr) { block.style.display = 'none'; noBlock.style.display = 'none'; return; }

  // Extract city
  let clean = '';
  const parts = addr.split(',');
  for (let pi = 0; pi < parts.length; pi++) {
    const pt = parts[pi].trim();
    if (/^(г\.?\s|город\s|г\s)/i.test(pt)) {
      clean = pt.replace(/^(г\.?\s*|город\s*)/i, '').trim(); break;
    }
  }
  if (!clean) {
    for (let pi = 0; pi < parts.length; pi++) {
      const pt = parts[pi].trim();
      if (/^(с\.?\s|п\.?\s|пгт\.?\s|село\s|посёлок\s|пос\.\s)/i.test(pt)) {
        clean = pt.replace(/^(с\.?\s*|п\.?\s*|пгт\.?\s*|село\s*|посёлок\s*|пос\.\s*)/i, '').trim(); break;
      }
    }
  }
  if (!clean && parts.length > 1) {
    clean = parts[1].trim().replace(/^(г\.?\s*|город\s*|с\.?\s*|п\.?\s*)/i, '').trim();
  }
  if (!clean) { block.style.display = 'none'; noBlock.style.display = 'none'; return; }

  try {
    const locRes = await sb.from('localities').select('id,name')
      .or('name.ilike.%' + clean + '%,name_alt.ilike.%' + clean + '%').limit(5);
    if (locRes.error || !locRes.data || !locRes.data.length) {
      block.style.display = 'none'; noBlock.style.display = 'flex'; return;
    }
    const localityIds = locRes.data.map(l => l.id);
    const dlRes = await sb.from('direction_localities').select('direction_id').in('locality_id', localityIds);
    if (dlRes.error || !dlRes.data || !dlRes.data.length) {
      block.style.display = 'none'; noBlock.style.display = 'flex'; return;
    }
    const dirIds = [...new Set(dlRes.data.map(d => d.direction_id))];
    const [dirRes, schedRes] = await Promise.all([
      sb.from('delivery_directions').select('id,name,depart_time').in('id', dirIds),
      sb.from('direction_schedules').select('*').in('direction_id', dirIds)
    ]);
    const dirs = dirRes.data || [];
    const scheds = schedRes.data || [];
    if (!dirs.length) { block.style.display = 'none'; noBlock.style.display = 'flex'; return; }

    noBlock.style.display = 'none';
    block.style.display = 'block';

    if (dirs.length === 1) {
      selectorEl.style.display = 'none';
      const s = scheds.filter(x => x.direction_id === dirs[0].id);
      textEl.innerHTML = _formatScheduleText(s, dirs[0].name) || dirs[0].name;
      const dates = _getNextDates(s, 5);
      window._confirmedDeliveryDate = dates[0] || null;
      _renderDeliveryDates(datesEl, dates, true);
      window._selectedConfirmDirection = dirs[0].id;
    } else {
      selectorEl.style.display = 'block';
      textEl.innerHTML = '';
      datesEl.innerHTML = '';
      optionsEl.innerHTML = '';
      window._selectedConfirmDirection = null;

      dirs.forEach((dir, i) => {
        const s = scheds.filter(x => x.direction_id === dir.id);
        const dates = _getNextDates(s, 3);
        const DAYS_SHORT = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        const datesHtml = dates.map(d => {
          const dow = d.getDay() === 0 ? 7 : d.getDay();
          return '<b>' + DAYS_SHORT[dow] + '</b> ' + d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        }).join(' · ');

        const btnEl = document.createElement('div');
        btnEl.style.cssText = 'padding:10px 13px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);cursor:pointer;font-size:0.83rem;color:rgba(255,255,255,0.8);transition:all 0.15s';
        btnEl.dataset.dirId = dir.id;
        btnEl.innerHTML = '<div style="font-weight:600;margin-bottom:3px">' + dir.name + '</div>' +
          '<div style="font-size:0.75rem;color:rgba(255,255,255,0.45)">' + datesHtml + '</div>';
        btnEl.addEventListener('click', () => {
          optionsEl.querySelectorAll('div[data-dir-id]').forEach(b => {
            b.style.background = '';
            b.style.borderColor = 'rgba(255,255,255,0.15)';
            b.style.color = 'rgba(255,255,255,0.8)';
          });
          btnEl.style.background = 'rgba(232,255,71,0.1)';
          btnEl.style.borderColor = 'rgba(232,255,71,0.5)';
          btnEl.style.color = '#e8ff47';
          window._selectedConfirmDirection = dir.id;
          const fs = scheds.filter(x => x.direction_id === dir.id);
          textEl.innerHTML = _formatScheduleText(fs, '') || '';
          const nd = _getNextDates(fs, 5);
          window._confirmedDeliveryDate = nd[0] || null;
          _renderDeliveryDates(datesEl, nd, true);
        });
        optionsEl.appendChild(btnEl);
        if (i === 0) btnEl.click();
      });
    }
  } catch (e) {
    console.warn('[confirmDelivery]', e.message);
    block.style.display = 'none';
  }
}

// Also expose as window global for OrderModal compatibility
window._loadConfirmDelivery = loadConfirmDelivery;

// ── Delivery info lookup (generic) ─────────────────────────
export async function showDeliveryInfo(cityName, targetEl, datesEl) {
  if (!cityName || !targetEl) return;
  targetEl.innerHTML = '<span style="opacity:0.5">Проверяем расписание…</span>';
  if (datesEl) datesEl.innerHTML = '';

  try {
    const clean = cityName
      .replace(/^(г\.|с\.|п\.|пгт\.|пос\.\s*|деревня\s|село\s|город\s|посёлок\s)/i, '')
      .trim();

    const res = await sb.from('localities').select('id, name')
      .or('name.ilike.%' + clean + '%,name_alt.ilike.%' + clean + '%').limit(5);

    if (res.error || !res.data || !res.data.length) {
      targetEl.innerHTML = '<span style="opacity:0.55">Расписание для вашего населённого пункта уточняйте у менеджера</span>';
      return;
    }
    const localityIds = res.data.map(l => l.id);
    const dlRes = await sb.from('direction_localities').select('direction_id').in('locality_id', localityIds);
    if (dlRes.error || !dlRes.data || !dlRes.data.length) {
      targetEl.innerHTML = '<span style="opacity:0.55">Расписание для вашего населённого пункта уточняйте у менеджера</span>';
      return;
    }
    const dirIds = [...new Set(dlRes.data.map(d => d.direction_id))];
    const [dirRes, schedRes] = await Promise.all([
      sb.from('delivery_directions').select('id, name, depart_time').in('id', dirIds),
      sb.from('direction_schedules').select('*').in('direction_id', dirIds)
    ]);
    if (!dirRes.data || !dirRes.data.length) {
      targetEl.innerHTML = '<span style="opacity:0.55">Расписание уточняйте у менеджера</span>';
      return;
    }
    const allSchedules = schedRes.data || [];
    const lines = dirRes.data.map(dir => {
      const sched = allSchedules.filter(s => s.direction_id === dir.id);
      return _formatScheduleText(sched, dir.name);
    }).filter(Boolean);
    targetEl.innerHTML = lines.join('<br>');

    if (datesEl) {
      const dates = _getNextDates(allSchedules, 5);
      const DAYS_SHORT = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
      datesEl.innerHTML = dates.map(date => {
        const dow = date.getDay() === 0 ? 7 : date.getDay();
        const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        return '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;' +
          'background:rgba(232,255,71,0.1);border:1px solid rgba(232,255,71,0.25);' +
          'border-radius:20px;font-size:0.72rem;color:#e8ff47">' +
          '<b>' + DAYS_SHORT[dow] + '</b> ' + dateStr + '</span>';
      }).join('');
    }
  } catch (e) {
    console.warn('[delivery info]', e.message);
    targetEl.innerHTML = '';
  }
}

window._showDeliveryInfo = showDeliveryInfo;

// ── Profile delivery info update ───────────────────────────
async function _updateProfileDeliveryInfo() {
  const infoWrap = document.getElementById('pf-delivery-info');
  const textEl = document.getElementById('pf-delivery-text');
  const datesEl = document.getElementById('pf-delivery-dates');
  if (!infoWrap || !textEl) return;

  const cityInput = document.getElementById('pf-addr-city');
  let city = cityInput ? cityInput.value.trim() : '';

  if (!city && _profileAddresses.length) {
    const addr = _profileAddresses[0];
    if (typeof addr === 'object') {
      city = addr.data && (addr.data.city || addr.data.settlement) || '';
      if (!city) city = addr.value || '';
    } else if (typeof addr === 'string') {
      const m = addr.match(/^([^,]+)/);
      if (m) city = m[1].trim();
    }
  }
  if (!city) { infoWrap.style.display = 'none'; return; }
  infoWrap.style.display = 'block';
  await showDeliveryInfo(city, textEl, datesEl);
}

window._updateProfileDeliveryInfo = _updateProfileDeliveryInfo;

// ── Init all profile listeners ─────────────────────────────
export function initProfileListeners() {
  const overlay = document.getElementById('profile-overlay');
  const closeBtn = document.getElementById('profile-close-btn');
  if (overlay) overlay.addEventListener('click', closeProfilePanel);
  if (closeBtn) closeBtn.addEventListener('click', closeProfilePanel);

  // Back buttons
  document.querySelectorAll('.pf-back').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.profile-subpanel').forEach(sp => sp.classList.remove('active'));
    });
  });

  // Nav items
  const navMap = {
    'pf-orders-btn': 'pf-sub-orders',
    'pf-clientdata-btn': 'pf-sub-clientdata',
    'pf-question-btn': 'pf-sub-question',
    'pf-legal-btn': 'pf-sub-legal',
  };
  Object.keys(navMap).forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', () => _profileOpenSub(navMap[id]));
  });

  // Logout
  const logoutBtn = document.getElementById('pf-logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => {
    closeProfilePanel();
    if (typeof window.doLogout === 'function') window.doLogout();
  });

  // Name save
  const nameSave = document.getElementById('pf-name-save');
  if (nameSave) nameSave.addEventListener('click', _profileSaveName);

  // DaData address fields
  const _ci = document.getElementById('pf-addr-city');
  const _si = document.getElementById('pf-addr-street');
  const _hi = document.getElementById('pf-addr-house');
  const _nor = document.getElementById('pf-addr-normalized');
  const _addrSaveBtn = document.getElementById('pf-addr-save');
  const _addrPreview = document.getElementById('pf-addr-preview-line');
  const _shi = document.getElementById('pf-addr-shop');

  function _addrResetFrom(level) {
    if (level <= 1) {
      if (_si) { _si.value = ''; }
      if (_hi) { _hi.value = ''; _hi.setAttribute('readonly', ''); _hi.placeholder = 'Сначала выберите улицу'; }
    }
    if (level <= 2) {
      if (_hi) { _hi.value = ''; _hi.setAttribute('readonly', ''); }
    }
    if (_nor) _nor.value = '';
    if (_addrPreview) { _addrPreview.style.display = 'none'; _addrPreview.textContent = ''; }
    if (_addrSaveBtn) { _addrSaveBtn.disabled = true; _addrSaveBtn.style.opacity = '0.4'; }
  }

  if (_si) _si.removeAttribute('readonly');

  let _ci_hint = null;
  if (_ci) {
    _ci.addEventListener('input', function () {
      _ci_hint = null;
      _addrResetFrom(1);
      _dadataQuery('city', this.value, null, 'pf-dadata-city-drop', (val, norm, cityFias, settlFias) => {
        _ci.value = val;
        _ci_hint = { text: val, cityFias: cityFias || '', settlFias: settlFias || '' };
        if (_si) { _si.removeAttribute('readonly'); _si.placeholder = 'Начните вводить улицу…'; _si.value = ''; _si.focus(); }
        _addrResetFrom(1);
        const _man = document.getElementById('pf-addr-manual');
        if (_man) {
          const mv = _man.value.trim();
          const cityPattern = /^[^,]+,\s*/;
          if (!mv || cityPattern.test(mv)) {
            const rest = mv.replace(cityPattern, '');
            _man.value = val + (rest ? ', ' + rest : ', ');
          } else {
            _man.value = val + ', ';
          }
        }
      });
    });
  }

  if (_si) {
    _si.addEventListener('focus', function () {
      if (this.hasAttribute('readonly')) { this.blur(); return; }
    });
    _si.addEventListener('input', function () {
      _addrResetFrom(2);
      const city = _ci_hint || { text: (_ci && _ci.value.trim()) || '' };
      _dadataQuery('street', this.value, city, 'pf-dadata-street-drop', val => {
        _si.value = val;
        if (_hi) { _hi.removeAttribute('readonly'); _hi.placeholder = 'напр. 12, 15А'; _hi.focus(); }
        if (_nor) _nor.value = '';
        if (_addrSaveBtn) { _addrSaveBtn.disabled = true; _addrSaveBtn.style.opacity = '0.4'; }
        const _man2 = document.getElementById('pf-addr-manual');
        if (_man2) {
          const mv2 = _man2.value.trim();
          const cityPart = mv2.split(',')[0] || (_ci ? _ci.value.trim() : '');
          _man2.value = cityPart + ', ' + val + ', ';
        }
      });
    });
  }

  if (_hi) {
    _hi.addEventListener('focus', function () {
      if (this.hasAttribute('readonly')) { this.blur(); return; }
    });
    _hi.addEventListener('input', function () {
      const self = this;
      if (_nor) _nor.value = '';
      if (_addrSaveBtn) { _addrSaveBtn.disabled = true; _addrSaveBtn.style.opacity = '0.4'; }
      const cityForHouse = _ci_hint || { text: (_ci && _ci.value.trim()) || '' };
      const street = (_si && _si.value.trim()) || '';
      const q = street ? street + ' ' + this.value : this.value;
      clearTimeout(_hi._fallbackTimer);
      _hi._fallbackTimer = setTimeout(() => {
        if (self.value.trim().length > 0) {
          const c = (_ci && _ci.value.trim()) || '';
          const s = (_si && _si.value.trim()) || '';
          const h = self.value.trim();
          const assembled = [c, s, h].filter(Boolean).join(', ');
          if (_nor && !_nor.value) _nor.value = assembled;
          if (_addrPreview) {
            const sh = _shi && _shi.value.trim();
            _addrPreview.textContent = '✓ ' + (sh ? assembled + ' (' + sh + ')' : assembled);
            _addrPreview.style.display = 'block';
          }
          if (_addrSaveBtn) { _addrSaveBtn.disabled = false; _addrSaveBtn.style.opacity = '1'; }
        }
      }, 1200);
      _dadataQuery('house', q, cityForHouse, 'pf-dadata-house-drop', (val, normalized) => {
        clearTimeout(_hi._fallbackTimer);
        _hi.value = val;
        if (_nor) _nor.value = normalized || val;
        if (_addrPreview) {
          const _shopVal = _shi && _shi.value.trim();
          const _basePreview = (_nor && _nor.value) ? _nor.value : [cityForHouse.text || '', street, val].filter(Boolean).join(', ');
          _addrPreview.textContent = '✓ ' + (_shopVal ? _basePreview + ' (' + _shopVal + ')' : _basePreview);
          _addrPreview.style.display = 'block';
        }
        if (_addrSaveBtn) { _addrSaveBtn.disabled = false; _addrSaveBtn.style.opacity = '1'; }
      });
    });
  }

  // Details toggle
  const _addrDetails = document.getElementById('pf-addr-details');
  const _addrArrow = document.getElementById('pf-addr-details-arrow');
  if (_addrDetails) {
    _addrDetails.addEventListener('toggle', function () {
      if (_addrArrow) _addrArrow.style.transform = this.open ? 'rotate(90deg)' : '';
      if (this.open) {
        if (_ci) { _ci.value = ''; }
        if (_si) { _si.value = ''; _si.removeAttribute('readonly'); }
        if (_hi) { _hi.value = ''; _hi.setAttribute('readonly', ''); _hi.placeholder = 'Сначала выберите улицу'; }
        if (_shi) { _shi.value = ''; }
        if (_nor) { _nor.value = ''; }
        const _m = document.getElementById('pf-addr-manual'); if (_m) _m.value = '';
        if (_addrPreview) { _addrPreview.style.display = 'none'; _addrPreview.textContent = ''; }
        if (_addrSaveBtn) { _addrSaveBtn.disabled = true; _addrSaveBtn.style.opacity = '0.4'; }
        const msg = document.getElementById('pf-addr-msg');
        if (msg) msg.textContent = '';
      }
    });
  }

  // Shop name updates preview
  if (_shi) _shi.addEventListener('input', function () {
    if (_addrPreview && _addrPreview.style.display !== 'none') {
      const _nor2 = document.getElementById('pf-addr-normalized');
      const _base = (_nor2 && _nor2.value) || '';
      _addrPreview.textContent = '✓ ' + (_base ? (_shi.value.trim() ? _base + ' (' + _shi.value.trim() + ')' : _base) : '');
    }
  });

  // Manual address input
  const _manualInput = document.getElementById('pf-addr-manual');
  if (_manualInput) {
    _manualInput.addEventListener('input', function () {
      const v = this.value.trim();
      if (v.length > 2) {
        if (_nor) _nor.value = v;
        if (_addrPreview) { _addrPreview.textContent = '✓ ' + v; _addrPreview.style.display = 'block'; }
        if (_addrSaveBtn) { _addrSaveBtn.disabled = false; _addrSaveBtn.style.opacity = '1'; }
      } else {
        if (_addrPreview) _addrPreview.style.display = 'none';
        if (_addrSaveBtn) { _addrSaveBtn.disabled = true; _addrSaveBtn.style.opacity = '0.4'; }
      }
    });
  }

  // Address save
  const addrSave = document.getElementById('pf-addr-save');
  if (addrSave) addrSave.addEventListener('click', async () => {
    const city = (_ci && _ci.value.trim()) || 'Уссурийск';
    const street = (_si && _si.value.trim()) || '';
    const house = (_hi && _hi.value.trim()) || '';
    const shop = (_shi && _shi.value.trim()) || '';
    const normalized = (_nor && _nor.value.trim()) || '';
    const msg = document.getElementById('pf-addr-msg');
    let manualVal = (document.getElementById('pf-addr-manual') || {}).value || '';
    manualVal = manualVal.trim();
    if (!manualVal) {
      if (!street) { if (msg) { msg.className = 'pf-msg err'; msg.textContent = 'Укажите улицу'; } return; }
      if (!house) { if (msg) { msg.className = 'pf-msg err'; msg.textContent = 'Укажите номер дома'; } return; }
    }
    let baseAddr;
    if (street && house) {
      baseAddr = normalized || [city, street, house].filter(Boolean).join(', ');
    } else if (manualVal) {
      baseAddr = manualVal;
    } else {
      baseAddr = normalized || [city, street, house].filter(Boolean).join(', ');
    }
    const val = shop ? baseAddr + ' (' + shop + ')' : baseAddr;
    if (_profileAddresses.indexOf(val) >= 0) {
      if (msg) { msg.className = 'pf-msg err'; msg.textContent = 'Этот адрес уже добавлен'; } return;
    }
    _profileAddresses.unshift(val);
    _selectedAddrIdx = 0;
    await _profileSaveAddresses();
    _profileRenderAddresses();
    if (window._updateProfileDeliveryInfo) window._updateProfileDeliveryInfo();
    // Reset form
    if (_ci) _ci.value = '';
    if (_si) { _si.value = ''; }
    if (_hi) { _hi.value = ''; _hi.setAttribute('readonly', ''); _hi.placeholder = 'Сначала выберите улицу'; }
    if (_shi) _shi.value = '';
    if (_nor) _nor.value = '';
    const _mf = document.getElementById('pf-addr-manual'); if (_mf) _mf.value = '';
    if (_addrPreview) { _addrPreview.style.display = 'none'; _addrPreview.textContent = ''; }
    if (_addrSaveBtn) { _addrSaveBtn.disabled = true; _addrSaveBtn.style.opacity = '0.4'; }
    const _det = document.getElementById('pf-addr-details');
    if (_det) _det.removeAttribute('open');
    if (msg) { msg.className = 'pf-msg ok'; msg.textContent = 'Адрес добавлен!'; setTimeout(() => { msg.textContent = ''; }, 2500); }
  });

  // Question send
  const qSend = document.getElementById('pf-question-send');
  if (qSend) qSend.addEventListener('click', _profileSendQuestion);
}
