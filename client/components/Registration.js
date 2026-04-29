/**
 * Registration Component
 * Multi-step wizard: type → data → address → submit request.
 * Steps: code-step-reg1 (type+data), code-step-reg2 (address), code-step-reg3 (confirm).
 */

import { sb } from '@shared/lib/supabase.js';
import { $ } from '@shared/lib/utils.js';
import { escHtml } from '@shared/lib/utils.js';
import { dadataQuery as dadataQueryShared, dadataPartySearch } from '@shared/lib/dadata.js';
import { showMsg, clearMsg, shakeField, showAlertPopup, closeOverlay } from './AuthModal.js';

// ── Registration data ──────────────────────────────────────
const _regData = {
  type: '', name: '', phone: '', email: '', address: '', shopName: '',
  _requestText: '', _legalLocked: false,
  _legalInn: '', _legalOgrn: '', _legalKpp: '', _legalAddr: null,
};

let _legalSubtype = 'ip';
let _legalDadataRaw = null;
let _legalSearchTimer = null;
let _legalAddrInited = { legal: false };
let _legalCityConfirmed = false;
let _legalStreetConfirmed = false;
let _legalCityHint = null;

const MANAGER_PHONE = '+7 (XXX) XXX-XX-XX';

// ── Phone helpers ──────────────────────────────────────────
function _rawPhone(val) {
  let d = (val || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.charAt(0) === '8' || d.charAt(0) === '7') d = '7' + d.slice(1);
  return '+' + d;
}

function initPhoneMask() {
  const ph = $('reg-phone');
  if (!ph) return;
  ph.addEventListener('focus', function () { if (!this.value) this.value = '+7 ('; });
  ph.addEventListener('input', function () {
    let raw = this.value.replace(/\D/g, '');
    if (raw.length === 0) { this.value = ''; return; }
    if (raw.charAt(0) !== '7') raw = '7' + raw;
    raw = raw.slice(0, 11);
    let out = '+7';
    if (raw.length > 1) out += ' (' + raw.slice(1, 4);
    if (raw.length >= 4) out += ') ' + raw.slice(4, 7);
    if (raw.length >= 7) out += '-' + raw.slice(7, 9);
    if (raw.length >= 9) out += '-' + raw.slice(9, 11);
    this.value = out;
  });
  ph.addEventListener('keydown', function (e) {
    if (e.key === 'Backspace' && (this.value === '+7 (' || this.value === '+7')) {
      this.value = ''; e.preventDefault();
    }
  });
}

// ── DaData dropdown rendering ──────────────────────────────
// The registration form uses floating dropdowns for address autocomplete.
// We wrap the shared dadataQuery with dropdown UI rendering.

function _dadataHideDrop(dropId) {
  const el = document.getElementById('dadata-float-' + dropId);
  if (el) el.remove();
}

function _dadataShowDrop(dropId, items, onSelect) {
  _dadataHideDrop(dropId);
  if (!items.length) return;

  const anchor = document.getElementById(dropId)?.closest('.auth-field') ||
    document.getElementById(dropId.replace('dadata-', '').replace('-drop', ''));

  const drop = document.createElement('div');
  drop.id = 'dadata-float-' + dropId;
  drop.style.cssText = 'position:fixed;z-index:10000;background:#13131a;border:1px solid rgba(100,180,255,0.2);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.4);max-height:200px;overflow-y:auto;font-size:0.82rem;color:#fff';

  items.forEach(s => {
    const row = document.createElement('div');
    row.style.cssText = 'padding:8px 12px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.04)';
    row.textContent = s._label || s.value;
    row.addEventListener('mouseenter', () => { row.style.background = 'rgba(100,180,255,0.1)'; });
    row.addEventListener('mouseleave', () => { row.style.background = ''; });
    row.addEventListener('click', () => {
      _dadataHideDrop(dropId);
      onSelect(s);
    });
    drop.appendChild(row);
  });

  document.body.appendChild(drop);

  // Position near anchor
  if (anchor) {
    const rect = anchor.getBoundingClientRect();
    drop.style.left = rect.left + 'px';
    drop.style.top = (rect.bottom + 4) + 'px';
    drop.style.width = rect.width + 'px';
  }

  // Close on outside click
  setTimeout(() => {
    const handler = (e) => {
      if (!drop.contains(e.target)) { _dadataHideDrop(dropId); document.removeEventListener('click', handler); }
    };
    document.addEventListener('click', handler);
  }, 50);
}

function _dadataQueryField(fieldType, query, cityHint, dropId, onSelect) {
  dadataQueryShared(fieldType, query, cityHint, {
    onResults: (suggestions) => {
      _dadataShowDrop(dropId, suggestions, (s) => {
        const d = s.data || {};
        if (fieldType === 'city') {
          const label = s._label || d.city_with_type || d.settlement_with_type || d.city || s.value;
          onSelect(label, s.value, d.city_fias_id || '', d.settlement_fias_id || '');
        } else if (fieldType === 'street') {
          const label = d.street_with_type || d.street || s.value;
          onSelect(label);
        } else {
          const houseNum = d.house || s.value;
          const normalized = s.value;
          onSelect(houseNum, normalized);
        }
      });
    },
    onEmpty: () => _dadataHideDrop(dropId),
    debounceMs: 400,
  });
}

// ── Legal entity helpers ───────────────────────────────────
function _legalFieldError(id, isError) {
  const el = $(id); if (!el) return;
  const wrap = el.closest('.auth-field');
  if (!wrap) return;
  if (isError) wrap.classList.add('field-error');
  else wrap.classList.remove('field-error');
}

function _legalSetSubtype(type) {
  _legalSubtype = type;
  const kpp = $('legal-kpp-wrap');
  const charter = $('legal-charter-wrap');
  const hint = $('legal-addr-hint');
  if (kpp) kpp.style.display = type === 'ooo' ? '' : 'none';
  if (charter) charter.style.display = type === 'ooo' ? '' : 'none';
  if (hint) hint.textContent = type === 'ip'
    ? '(\u0430\u0434\u0440\u0435\u0441 \u043f\u0440\u043e\u043f\u0438\u0441\u043a\u0438 \u043f\u0440\u0435\u0434\u043f\u0440\u0438\u043d\u0438\u043c\u0430\u0442\u0435\u043b\u044f)'
    : '(\u044e\u0440\u0438\u0434\u0438\u0447\u0435\u0441\u043a\u0438\u0439 \u0430\u0434\u0440\u0435\u0441 \u043e\u0440\u0433\u0430\u043d\u0438\u0437\u0430\u0446\u0438\u0438)';
}

function _showLegalDetails() {
  const details = $('legal-details');
  const nameWrap = $('legal-name-wrap');
  if (details) details.style.display = 'block';
  if (nameWrap) nameWrap.style.display = 'block';
  if (!_legalAddrInited.legal) { _initLegalAddrBlock('legal'); _legalAddrInited.legal = true; }
}

function _fillLegalFromDadata(suggestion) {
  const d = suggestion.data || {};
  _legalDadataRaw = suggestion;
  const isIP = (d.opf?.short?.indexOf('\u0418\u041f') !== -1) ||
    (suggestion.value?.startsWith('\u0418\u041f ')) ||
    (suggestion.value?.startsWith('\u0418\u043d\u0434\u0438\u0432\u0438\u0434\u0443\u0430\u043b\u044c\u043d\u044b\u0439'));
  _legalSetSubtype(isIP ? 'ip' : 'ooo');

  const searchEl = $('legal-unified-search');
  if (searchEl) { searchEl.value = suggestion.value || ''; searchEl.setAttribute('readonly', ''); }
  const resetWrap = $('legal-reset-wrap');
  if (resetWrap) resetWrap.style.display = 'block';

  _showLegalDetails();

  const set = (id, val) => { const el = $(id); if (el && val) { el.value = val; _legalFieldError(id, false); } };
  set('reg-org-name', suggestion.value);
  set('reg-inn', d.inn);
  set('reg-ogrn', d.ogrn);
  set('reg-kpp', d.kpp);

  if (d.management?.name) _legalDadataRaw._directorName = d.management.name;

  ['reg-org-name', 'reg-inn', 'reg-ogrn', 'reg-kpp'].forEach(id => {
    const el = $(id);
    if (el && el.value.trim()) el.setAttribute('readonly', '');
  });

  _validateReg1();
}

function _applyLegalLock() {
  ['reg-org-name', 'reg-inn', 'reg-ogrn', 'reg-kpp'].forEach(id => {
    const el = $(id); if (el) el.setAttribute('readonly', '');
  });
  const searchEl = $('legal-unified-search');
  if (searchEl) searchEl.setAttribute('readonly', '');
  const resetWrap = $('legal-reset-wrap');
  if (resetWrap) resetWrap.style.display = 'none';
  const lockBanner = $('legal-lock-banner');
  if (lockBanner) lockBanner.style.display = 'flex';
}

function _clearLegalLock() {
  _regData._legalLocked = false;
  ['reg-org-name', 'reg-inn', 'reg-ogrn', 'reg-kpp'].forEach(id => {
    const el = $(id); if (el) el.removeAttribute('readonly');
  });
  const searchEl = $('legal-unified-search');
  if (searchEl) searchEl.removeAttribute('readonly');
  const lockBanner = $('legal-lock-banner');
  if (lockBanner) lockBanner.style.display = 'none';
}

window._legalReset = function () {
  ['reg-org-name', 'reg-inn', 'reg-ogrn', 'reg-kpp'].forEach(id => {
    const el = $(id); if (el) { el.removeAttribute('readonly'); el.value = ''; }
  });
  const ac = $('legal-addr-city'), as_ = $('legal-addr-street'),
    ah = $('legal-addr-house'), an = $('legal-addr-normalized');
  if (ac) { ac.value = ''; ac.removeAttribute('readonly'); }
  if (as_) { as_.value = ''; as_.removeAttribute('readonly'); }
  if (ah) { ah.value = ''; ah.setAttribute('readonly', ''); ah.placeholder = '\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0443\u043b\u0438\u0446\u0443'; }
  if (an) an.value = '';
  ['legal-addr-city', 'legal-addr-street', 'legal-addr-house'].forEach(id => {
    const el = $(id); if (!el) return;
    const wrap = el.closest('.auth-field');
    if (wrap) wrap.classList.remove('addr-field-confirmed', 'addr-field-dirty');
  });
  _legalDadataRaw = null;
  _legalCityConfirmed = false;
  _legalStreetConfirmed = false;
  _legalCityHint = null;
  _regData._legalLocked = false;
  const lockBanner = $('legal-lock-banner');
  if (lockBanner) lockBanner.style.display = 'none';
  const details = $('legal-details');
  const nameWrap = $('legal-name-wrap');
  const resetWrap = $('legal-reset-wrap');
  if (details) details.style.display = 'none';
  if (nameWrap) nameWrap.style.display = 'none';
  if (resetWrap) resetWrap.style.display = 'none';
  const searchEl = $('legal-unified-search');
  if (searchEl) { searchEl.removeAttribute('readonly'); searchEl.value = ''; searchEl.focus(); }
  const list = $('legal-org-list'); if (list) { list.innerHTML = ''; list.style.display = 'none'; }
  _validateReg1();
};

// ── Validation ─────────────────────────────────────────────
function _validateReg1() {
  const type = _regData.type;
  const btn = $('btn-reg1-next');
  if (!type || !btn) return;
  let ok = false;
  if (type === 'physical') {
    const fn = ($('reg-first-name')?.value || '').trim();
    ok = fn.length >= 2;
  } else {
    const nm = ($('reg-org-name')?.value || '').trim();
    const inn = ($('reg-inn')?.value || '').trim();
    const ogrn = ($('reg-ogrn')?.value || '').trim();
    const lCity = ($('legal-addr-city')?.value || '').trim();
    const lStr = ($('legal-addr-street')?.value || '').trim();
    const lHouse = ($('legal-addr-house')?.value || '').trim();
    const lNorm = ($('legal-addr-normalized')?.value || '').trim();
    const lOk = lNorm.length >= 5 || (lCity.length >= 2 && lStr.length >= 2 && lHouse.length >= 1);
    ok = nm.length >= 2 && inn.length >= 10 && ogrn.length >= 13 && lOk;
    _legalFieldError('reg-org-name', nm.length < 2);
    _legalFieldError('reg-inn', inn.length < 10);
    _legalFieldError('reg-ogrn', ogrn.length < 13);
    _legalFieldError('legal-addr-city', !lCity);
    _legalFieldError('legal-addr-street', !lStr);
    _legalFieldError('legal-addr-house', !lHouse);
  }
  btn.disabled = !ok;
}

// ── Address block initializer (legal addr DaData) ──────────
function _initLegalAddrBlock(prefix) {
  const ci = () => $(prefix + '-addr-city');
  const si = () => $(prefix + '-addr-street');
  const hi = () => $(prefix + '-addr-house');
  const ni = () => $(prefix + '-addr-normalized');

  function _markConfirmed(field) {
    const el = field === 'city' ? ci() : field === 'street' ? si() : hi();
    if (!el) return;
    const wrap = el.closest('.auth-field');
    if (wrap) { wrap.classList.add('addr-field-confirmed'); wrap.classList.remove('addr-field-dirty'); }
    el.setAttribute('readonly', '');
  }
  function _markDirty(field) {
    const el = field === 'city' ? ci() : field === 'street' ? si() : hi();
    if (!el) return;
    const wrap = el.closest('.auth-field');
    if (wrap) { wrap.classList.add('addr-field-dirty'); wrap.classList.remove('addr-field-confirmed'); }
    el.removeAttribute('readonly');
  }
  function _clearConfirm(field) {
    const el = field === 'city' ? ci() : field === 'street' ? si() : hi();
    if (!el) return;
    const wrap = el.closest('.auth-field');
    if (wrap) wrap.classList.remove('addr-field-confirmed', 'addr-field-dirty');
    el.removeAttribute('readonly');
  }

  const rci = ci(), rsi = si(), rhi = hi();
  if (!rci) return;
  if (rsi) rsi.removeAttribute('readonly');
  if (rhi) { rhi.setAttribute('readonly', ''); rhi.placeholder = '\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0443\u043b\u0438\u0446\u0443'; }

  rci.addEventListener('input', function () {
    _legalCityHint = null; _legalCityConfirmed = false; _legalStreetConfirmed = false;
    _clearConfirm('city'); _clearConfirm('street'); _clearConfirm('house');
    const s = si(), h = hi(), n = ni();
    if (s) { s.value = ''; s.removeAttribute('readonly'); }
    if (h) { h.value = ''; h.setAttribute('readonly', ''); h.placeholder = '\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0443\u043b\u0438\u0446\u0443'; }
    if (n) n.value = '';
    _dadataQueryField('city', this.value, null, prefix + '-dadata-city-drop', (val, norm, cityFias, settlFias) => {
      ci().value = val;
      _legalCityHint = { text: val, cityFias: cityFias || '', settlFias: settlFias || '' };
      _legalCityConfirmed = true;
      _markConfirmed('city');
      const s2 = si(), h2 = hi(), n2 = ni();
      if (s2) { s2.value = ''; s2.removeAttribute('readonly'); _clearConfirm('street'); s2.focus(); }
      if (h2) { h2.value = ''; h2.setAttribute('readonly', ''); _clearConfirm('house'); }
      if (n2) n2.value = '';
      _validateReg1();
    });
  });

  rci.addEventListener('focus', function () {
    if (this.hasAttribute('readonly')) {
      this.removeAttribute('readonly');
      _legalCityConfirmed = false;
      _markDirty('city');
      _validateReg1();
    }
  });

  rci.addEventListener('blur', function () {
    if (!_legalCityConfirmed && this.value.trim()) {
      setTimeout(() => {
        const drop = document.getElementById('dadata-float-' + prefix + '-dadata-city-drop');
        if (!drop) { ci().value = ''; _validateReg1(); }
      }, 200);
    }
  });

  if (rsi) {
    rsi.addEventListener('input', function () {
      _legalStreetConfirmed = false;
      _clearConfirm('street'); _clearConfirm('house');
      const h = hi(), n = ni();
      if (h) { h.value = ''; h.setAttribute('readonly', ''); }
      if (n) n.value = '';
      const hint = _legalCityHint || { text: ci()?.value.trim() || '' };
      _dadataQueryField('street', this.value, hint, prefix + '-dadata-street-drop', (val) => {
        si().value = val;
        _legalStreetConfirmed = true;
        _markConfirmed('street');
        const h2 = hi(), n2 = ni();
        if (h2) { h2.removeAttribute('readonly'); h2.placeholder = '\u043d\u0430\u043f\u0440. 12, 15\u0410'; _clearConfirm('house'); h2.focus(); }
        if (n2) n2.value = '';
      });
    });

    rsi.addEventListener('focus', function () {
      if (this.hasAttribute('readonly')) {
        this.removeAttribute('readonly');
        _legalStreetConfirmed = false;
        _markDirty('street');
        _validateReg1();
      }
    });

    rsi.addEventListener('blur', function () {
      if (!_legalStreetConfirmed && this.value.trim()) {
        setTimeout(() => {
          const drop = document.getElementById('dadata-float-' + prefix + '-dadata-street-drop');
          if (!drop) { si().value = ''; _validateReg1(); }
        }, 200);
      }
    });
  }

  if (rhi) {
    rhi.addEventListener('input', function () {
      _clearConfirm('house');
      const n = ni(); if (n) n.value = '';
      clearTimeout(rhi._fb);
      rhi._fb = setTimeout(() => {
        const c = ci()?.value.trim() || '';
        const s = si()?.value.trim() || '';
        const nn = ni();
        if (rhi.value.trim() && nn && !nn.value) nn.value = [c, s, rhi.value.trim()].filter(Boolean).join(', ');
        _validateReg1();
      }, 1200);
      const hint = _legalCityHint || { text: ci()?.value.trim() || '' };
      const streetVal = si()?.value.trim() || '';
      _dadataQueryField('house', streetVal + ' ' + this.value, hint, prefix + '-dadata-house-drop', (val, norm) => {
        clearTimeout(rhi._fb);
        hi().value = val;
        _markConfirmed('house');
        const nn = ni();
        if (nn) nn.value = norm || val;
        _validateReg1();
      });
    });

    rhi.addEventListener('focus', function () {
      if (this.hasAttribute('readonly')) {
        this.removeAttribute('readonly');
        _markDirty('house');
        _validateReg1();
      }
    });
  }
}

// ── Registration address step (step 2) ─────────────────────
function _regInitAddr() {
  let rci = $('reg-addr-city'), rsi = $('reg-addr-street'), rhi = $('reg-addr-house'), rni = $('reg-addr-normalized');
  if (rsi) rsi.removeAttribute('readonly');
  if (rhi) { rhi.setAttribute('readonly', ''); rhi.placeholder = '\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0443\u043b\u0438\u0446\u0443'; }
  if (rni) rni.value = '';

  let _regCityConfirmed = false;
  let _regStreetConfirmed = false;
  let _regHouseConfirmed = false;

  function _regMark(el, confirmed) {
    const wrap = el?.closest('.auth-field');
    if (!wrap) return;
    if (confirmed) { wrap.classList.add('addr-field-confirmed'); wrap.classList.remove('addr-field-dirty'); el.setAttribute('readonly', ''); }
    else { wrap.classList.add('addr-field-dirty'); wrap.classList.remove('addr-field-confirmed'); el.removeAttribute('readonly'); }
  }
  function _regClearMark(el) {
    const wrap = el?.closest('.auth-field');
    if (wrap) wrap.classList.remove('addr-field-confirmed', 'addr-field-dirty');
    el?.removeAttribute('readonly');
  }
  function _regResetStreetHouse() {
    _regStreetConfirmed = false; _regHouseConfirmed = false;
    if (rsi) { rsi.value = ''; _regClearMark(rsi); }
    if (rhi) { rhi.value = ''; rhi.setAttribute('readonly', ''); rhi.placeholder = '\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0443\u043b\u0438\u0446\u0443'; _regClearMark(rhi); }
    if (rni) rni.value = '';
  }
  function _regResetHouse() {
    _regHouseConfirmed = false;
    if (rhi) { rhi.value = ''; rhi.setAttribute('readonly', ''); _regClearMark(rhi); }
    if (rni) rni.value = '';
  }

  // Clone to remove old listeners
  if (rci) { const nc = rci.cloneNode(true); rci.parentNode.replaceChild(nc, rci); rci = nc; }
  if (rsi) { const ns = rsi.cloneNode(true); rsi.parentNode.replaceChild(ns, rsi); rsi = ns; }
  if (rhi) { const nh = rhi.cloneNode(true); rhi.parentNode.replaceChild(nh, rhi); rhi = nh; }
  rci = $('reg-addr-city'); rsi = $('reg-addr-street'); rhi = $('reg-addr-house'); rni = $('reg-addr-normalized');

  if (rci) {
    rci.addEventListener('input', function () {
      _regCityConfirmed = false; _regClearMark(rci); _regResetStreetHouse();
      _dadataQueryField('city', this.value, null, 'reg-dadata-city-drop', (val, norm, cityFias, settlFias) => {
        rci.value = val;
        rci._cityHint = { text: val, cityFias: cityFias || '', settlFias: settlFias || '' };
        _regCityConfirmed = true;
        _regMark(rci, true);
        _regResetStreetHouse();
        if (rsi) { rsi.removeAttribute('readonly'); rsi.focus(); }
        // Show delivery info
        const infoWrap = document.getElementById('reg-delivery-info');
        const textEl = document.getElementById('reg-delivery-text');
        const datesEl = document.getElementById('reg-delivery-dates');
        if (infoWrap && textEl && window._showDeliveryInfo) {
          infoWrap.style.display = 'block';
          window._showDeliveryInfo(val, textEl, datesEl);
        }
      });
    });
    rci.addEventListener('focus', function () {
      if (this.hasAttribute('readonly')) {
        this.removeAttribute('readonly'); _regCityConfirmed = false;
        _regMark(rci, false); _regResetStreetHouse();
      }
    });
    rci.addEventListener('blur', function () {
      if (!_regCityConfirmed && this.value.trim()) {
        setTimeout(() => {
          const drop = document.getElementById('dadata-float-reg-dadata-city-drop');
          if (!drop) { rci.value = ''; _regClearMark(rci); }
        }, 200);
      }
    });
  }

  if (rsi) {
    rsi.addEventListener('input', function () {
      _regStreetConfirmed = false; _regClearMark(rsi); _regResetHouse();
      const hint = rci._cityHint || { text: rci?.value.trim() || '' };
      _dadataQueryField('street', this.value, hint, 'reg-dadata-street-drop', (val) => {
        rsi.value = val; _regStreetConfirmed = true; _regMark(rsi, true);
        _regResetHouse();
        if (rhi) { rhi.removeAttribute('readonly'); rhi.placeholder = '\u043d\u0430\u043f\u0440. 12, 15\u0410'; _regClearMark(rhi); rhi.focus(); }
        if (rni) rni.value = '';
      });
    });
    rsi.addEventListener('focus', function () {
      if (this.hasAttribute('readonly')) {
        this.removeAttribute('readonly'); _regStreetConfirmed = false;
        _regMark(rsi, false); _regResetHouse();
      }
    });
    rsi.addEventListener('blur', function () {
      if (!_regStreetConfirmed && this.value.trim()) {
        setTimeout(() => {
          const drop = document.getElementById('dadata-float-reg-dadata-street-drop');
          if (!drop) { rsi.value = ''; _regClearMark(rsi); }
        }, 200);
      }
    });
  }

  if (rhi) {
    rhi._fb = null;
    rhi.addEventListener('input', function () {
      _regHouseConfirmed = false; _regClearMark(rhi);
      if (rni) rni.value = '';
      clearTimeout(rhi._fb);
      rhi._fb = setTimeout(() => {
        if (rhi.value.trim()) {
          const c = rci?.value.trim() || '', s = rsi?.value.trim() || '';
          if (rni && !rni.value) rni.value = [c, s, rhi.value.trim()].filter(Boolean).join(', ');
        }
      }, 1200);
      const hint = rci._cityHint || { text: rci?.value.trim() || '' };
      _dadataQueryField('house', (rsi?.value.trim() || '') + ' ' + this.value, hint, 'reg-dadata-house-drop', (val, norm) => {
        clearTimeout(rhi._fb);
        rhi.value = val; _regHouseConfirmed = true; _regMark(rhi, true);
        if (rni) rni.value = norm || val;
      });
    });
    rhi.addEventListener('focus', function () {
      if (this.hasAttribute('readonly') && _regHouseConfirmed) {
        this.removeAttribute('readonly'); _regHouseConfirmed = false;
        _regMark(rhi, false); if (rni) rni.value = '';
      }
    });
  }

  const man = $('reg-addr-manual');
  if (man) man.addEventListener('input', function () { if (rni && this.value.trim().length > 2) rni.value = this.value.trim(); });
}

// ── Duplicate check ────────────────────────────────────────
async function _checkDuplicateClient(data) {
  const sbClient = sb;
  const res = await sbClient.rpc('check_duplicate_client', {
    p_name: data.name?.trim() || null,
    p_type: data.type || null,
    p_inn: data.inn?.trim() || null,
    p_address: data.address?.trim() || null,
  });
  if (res.error) { console.warn('check_duplicate_client RPC error:', res.error); return null; }
  return res.data || null;
}

// ── Build request text (step 3) ────────────────────────────
async function _buildRequestText() {
  const tl = _regData.type === 'physical' ? '\u0424\u0438\u0437\u0438\u0447\u0435\u0441\u043a\u043e\u0435 \u043b\u0438\u0446\u043e' : '\u042e\u0440\u0438\u0434\u0438\u0447\u0435\u0441\u043a\u043e\u0435 \u043b\u0438\u0446\u043e';
  const phoneVal = _regData.phone || '\u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d';
  let text = '\u0417\u0434\u0440\u0430\u0432\u0441\u0442\u0432\u0443\u0439\u0442\u0435!\n' +
    '\u041f\u0440\u043e\u0448\u0443 \u043f\u0440\u0435\u0434\u043e\u0441\u0442\u0430\u0432\u0438\u0442\u044c \u043b\u0438\u0447\u043d\u044b\u0439 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u043e\u043d\u043d\u044b\u0439 \u043a\u043e\u0434 \u0434\u043b\u044f \u0430\u0432\u0442\u043e\u0440\u0438\u0437\u0430\u0446\u0438\u0438 \u0432 \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0438 ONLINE-\u041e\u041f\u0422\u041e\u0412\u0418\u041a.\n\n' +
    '\u0422\u0438\u043f: ' + tl + '\n' +
    '\u0418\u043c\u044f / \u041d\u0430\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u043d\u0438\u0435: ' + _regData.name + '\n' +
    (phoneVal !== '\u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d' ? '\u0422\u0435\u043b\u0435\u0444\u043e\u043d: ' + phoneVal + '\n' : '') +
    (_regData.email ? 'E-mail: ' + _regData.email + '\n' : '') +
    '\u0410\u0434\u0440\u0435\u0441 \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0438: ' + _regData.address;

  const el = $('reg-request-text');
  if (el) el.textContent = text;
  _regData._requestText = text;

  const statusEl = $('reg-save-status');
  if (statusEl) { statusEl.textContent = '\u23f3 \u041e\u0442\u043f\u0440\u0430\u0432\u043b\u044f\u0435\u043c \u0437\u0430\u044f\u0432\u043a\u0443\u2026'; statusEl.style.color = 'rgba(255,255,255,0.4)'; }

  try {
    const insertData = {
      type: _regData.type,
      name: _regData.name,
      phone: phoneVal,
      email: _regData.email || null,
      delivery_address: _regData.address,
      status: 'new',
    };
    if (_regData.type === 'legal') {
      insertData.inn = _regData._legalInn?.trim() || null;
      insertData.ogrn = _regData._legalOgrn?.trim() || null;
      insertData.kpp = _regData._legalKpp?.trim() || null;
      insertData.legal_address = _regData._legalAddr || null;
      insertData.postal_address = _regData.address || null;
      insertData.company_full_name = _regData.name || null;
      if (_legalDadataRaw?._directorName) insertData.director_name = _legalDadataRaw._directorName;
      if (_legalDadataRaw) {
        const raw = { ..._legalDadataRaw };
        delete raw._directorName;
        insertData.dadata_raw = raw;
      }
    }
    const res = await sb.from('registration_requests').insert(insertData);
    if (res.error) throw res.error;
    if (statusEl) { statusEl.textContent = '\u2705 \u0417\u0430\u044f\u0432\u043a\u0430 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0430'; statusEl.style.color = '#69f0ae'; }
  } catch (e) {
    console.error('reg save error:', e);
    if (statusEl) { statusEl.textContent = '\u26a0\ufe0f \u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c: ' + e.message; statusEl.style.color = '#fc8181'; }
  }
}

// ── Legal Search ───────────────────────────────────────────
async function _legalSearch(query) {
  const spin = $('legal-spin');
  if (spin) spin.style.display = 'block';
  try {
    const suggestions = await dadataPartySearch(query, { count: 15 });
    _renderLegalList(suggestions);
  } catch (e) {
    console.warn('legal search:', e.message);
    _renderLegalList([]);
  } finally {
    if (spin) spin.style.display = 'none';
  }
}

function _renderLegalList(suggestions) {
  const list = $('legal-org-list');
  const notFound = $('legal-org-not-found');
  if (!list) return;
  if (!suggestions.length) {
    list.style.display = 'none';
    if (notFound) notFound.style.display = 'block';
    _showLegalDetails();
    return;
  }
  if (notFound) notFound.style.display = 'none';
  list.innerHTML = '';

  suggestions.forEach(s => {
    const d = s.data || {};
    const isIP = (d.opf?.short?.indexOf('\u0418\u041f') !== -1) ||
      (s.value?.startsWith('\u0418\u041f ')) ||
      (s.value?.startsWith('\u0418\u043d\u0434\u0438\u0432\u0438\u0434\u0443\u0430\u043b\u044c\u043d\u044b\u0439'));
    const status = d.state?.status !== 'ACTIVE'
      ? ' <span style="color:#fc8181;font-size:0.68rem">[\u043b\u0438\u043a\u0432\u0438\u0434.]</span>' : '';
    const addrData = d.address?.data || {};
    const regionStr = addrData.region_with_type || addrData.region || '';
    const cityStr = addrData.city_with_type || addrData.settlement_with_type || addrData.city || addrData.settlement || '';
    let locationStr = [regionStr, cityStr].filter(x => x && (x !== regionStr || !cityStr)).join(', ');
    if (!locationStr && d.address?.value) locationStr = d.address.value.split(',').slice(0, 2).join(',').trim();

    const row = document.createElement('div');
    row.className = 'legal-org-row';
    row.innerHTML = '<div class="legal-org-row-name">' + escHtml(s.value || '') + status + '</div>'
      + '<div class="legal-org-row-meta">'
      + (isIP ? '\u0418\u041f' : '\u041e\u041e\u041e') + ' \u00b7 \u0418\u041d\u041d: ' + escHtml(d.inn || '\u2014')
      + (d.ogrn ? ' \u00b7 \u041e\u0413\u0420\u041d: ' + escHtml(d.ogrn) : '')
      + (locationStr ? ' \u00b7 ' + escHtml(locationStr) : '')
      + '</div>';

    row.addEventListener('click', async () => {
      list.querySelectorAll('.legal-org-row').forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
      _fillLegalFromDadata(s);
      list.style.display = 'none';

      // Check if this org already exists
      const inn = (d.inn || '').trim();
      if (inn) {
        try {
          const res = await sb.rpc('check_inn_exists', { p_inn: inn });
          if (!res.error && res.data) {
            showAlertPopup(
              '\u0414\u0430\u043d\u043d\u043e\u0435 \u044e\u0440\u0438\u0434\u0438\u0447\u0435\u0441\u043a\u043e\u0435 \u043b\u0438\u0446\u043e \u0443\u0436\u0435 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u043d\u043e \u0432 \u0441\u0438\u0441\u0442\u0435\u043c\u0435.\n\n\u0415\u0441\u043b\u0438 \u044d\u0442\u043e \u0432\u044b \u0438 \u0445\u043e\u0442\u0438\u0442\u0435 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0435\u0449\u0451 \u043e\u0434\u0438\u043d \u0430\u0434\u0440\u0435\u0441 \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0438 \u2014 \u043d\u0430\u0436\u043c\u0438\u0442\u0435 \u00ab\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0430\u0434\u0440\u0435\u0441\u00bb.',
              {
                title: s.value || '\u042e\u0440\u043b\u0438\u0446\u043e \u0443\u0436\u0435 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u043d\u043e',
                icon: '\ud83c\udfe2',
                okLabel: '\u041e\u0442\u043c\u0435\u043d\u0430',
                secondLabel: '\u2795 \u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0430\u0434\u0440\u0435\u0441 \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0438',
                onSecond: () => {
                  const name = ($('reg-org-name')?.value || '').trim() || s.value;
                  _regData.name = name;
                  _regData.phone = _rawPhone($('reg-phone')?.value || '');
                  _regData.email = ($('reg-email')?.value || '').trim();
                  _regData._legalInn = ($('reg-inn')?.value || '').trim();
                  _regData._legalOgrn = ($('reg-ogrn')?.value || '').trim();
                  _regData._legalKpp = ($('reg-kpp')?.value || '').trim();
                  const lNorm = ($('legal-addr-normalized')?.value || '').trim();
                  const lCity = ($('legal-addr-city')?.value || '').trim();
                  const lStr = ($('legal-addr-street')?.value || '').trim();
                  const lHs = ($('legal-addr-house')?.value || '').trim();
                  _regData._legalAddr = lNorm || [lCity, lStr, lHs].filter(Boolean).join(', ') || null;
                  _regData._legalLocked = true;
                  clearMsg('auth-msg-reg1');
                  window._codeShowStep('code-step-reg2');
                  _regInitAddr();
                },
              }
            );
          }
        } catch (e) { console.warn('check_inn_exists failed:', e); }
      }
    });
    list.appendChild(row);
  });
  list.style.display = 'block';
}

// ── Init Registration Listeners ────────────────────────────
export function initRegistrationListeners() {
  initPhoneMask();
  _legalSetSubtype('ip');

  // Set type
  window._regSetType = function (type) {
    _regData.type = type;
    $('reg-type-physical')?.classList.toggle('active', type === 'physical');
    $('reg-type-legal')?.classList.toggle('active', type === 'legal');
    const phFields = $('reg-fields-physical');
    const lgFields = $('reg-fields-legal');
    if (phFields) phFields.style.display = type === 'physical' ? 'block' : 'none';
    if (lgFields) lgFields.style.display = type === 'legal' ? 'block' : 'none';
    _validateReg1();
  };

  // Validation on input
  ['reg-first-name', 'reg-last-name', 'reg-org-name', 'reg-inn', 'reg-ogrn', 'reg-kpp',
    'reg-legal-addr', 'reg-phone', 'reg-email'].forEach(id => {
    $(id)?.addEventListener('input', _validateReg1);
  });

  // Legal search
  const searchEl = $('legal-unified-search');
  if (searchEl) {
    searchEl.addEventListener('input', function () {
      const v = this.value.trim();
      const list = $('legal-org-list');
      if (list) { list.innerHTML = ''; list.style.display = 'none'; }
      if (v.length < 4) return;
      clearTimeout(_legalSearchTimer);
      _legalSearchTimer = setTimeout(() => _legalSearch(v), 500);
    });
  }

  // Step 1 → Step 2
  $('btn-reg1-next')?.addEventListener('click', async () => {
    const type = _regData.type;
    if (!type) { showAlertPopup('\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u0438\u043f \u043a\u043b\u0438\u0435\u043d\u0442\u0430.'); return; }
    let name = '';
    if (type === 'physical') {
      const fn = ($('reg-first-name')?.value || '').trim();
      const ln = ($('reg-last-name')?.value || '').trim();
      if (!fn) { shakeField($('reg-first-name')); showAlertPopup('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u043c\u044f.'); return; }
      name = fn + (ln ? ' ' + ln : '');
    } else {
      name = ($('reg-org-name')?.value || '').trim();
      if (!name) { shakeField($('reg-org-name')); showAlertPopup('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043d\u0430\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u043d\u0438\u0435 \u043e\u0440\u0433\u0430\u043d\u0438\u0437\u0430\u0446\u0438\u0438.'); return; }
      _regData._legalInn = ($('reg-inn')?.value || '').trim();
      _regData._legalOgrn = ($('reg-ogrn')?.value || '').trim();
      _regData._legalKpp = ($('reg-kpp')?.value || '').trim();
      const lNorm = ($('legal-addr-normalized')?.value || '').trim();
      const lCity = ($('legal-addr-city')?.value || '').trim();
      const lStr = ($('legal-addr-street')?.value || '').trim();
      const lHs = ($('legal-addr-house')?.value || '').trim();
      _regData._legalAddr = lNorm || [lCity, lStr, lHs].filter(Boolean).join(', ') || null;
    }
    const phone = _rawPhone($('reg-phone')?.value || '');
    _regData.name = name;
    _regData.phone = phone;
    _regData.email = ($('reg-email')?.value || '').trim();

    // Duplicate check for physical
    if (type === 'physical') {
      const btn = $('btn-reg1-next');
      const origText = btn?.textContent || '\u0414\u0430\u043b\u0435\u0435 \u2192';
      if (btn) { btn.disabled = true; btn.textContent = '\u23f3 \u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430\u2026'; }
      try {
        const dupMsg = await _checkDuplicateClient({ name, type, inn: '' });
        if (dupMsg) {
          if (btn) { btn.disabled = false; btn.textContent = origText; }
          shakeField($('reg-first-name'));
          showAlertPopup(dupMsg + '\n\n\u0415\u0441\u043b\u0438 \u044d\u0442\u043e \u0434\u0440\u0443\u0433\u043e\u0439 \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u2014 \u0432\u0432\u0435\u0434\u0438\u0442\u0435 \u0434\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u044b.');
          return;
        }
      } catch (e) { console.warn('Duplicate check failed:', e); }
      if (btn) { btn.disabled = false; btn.textContent = origText; }
    }

    clearMsg('auth-msg-reg1');
    window._codeShowStep('code-step-reg2');
    _regInitAddr();
  });

  // Step 2 → Step 3
  $('btn-reg2-next')?.addEventListener('click', async () => {
    const rni = $('reg-addr-normalized'), rci = $('reg-addr-city'), rsi = $('reg-addr-street'), rhi = $('reg-addr-house');
    const city = rci?.value.trim() || '';
    const street = rsi?.value.trim() || '';
    const house = rhi?.value.trim() || '';
    if (!city) { shakeField(rci); showAlertPopup('\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043d\u0430\u0441\u0435\u043b\u0451\u043d\u043d\u044b\u0439 \u043f\u0443\u043d\u043a\u0442 \u0438\u0437 \u0441\u043f\u0438\u0441\u043a\u0430.'); rci?.focus(); return; }
    if (!street) { shakeField(rsi); showAlertPopup('\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0443\u043b\u0438\u0446\u0443 \u0438\u0437 \u0441\u043f\u0438\u0441\u043a\u0430.'); rsi?.focus(); return; }
    if (!house) { shakeField(rhi); showAlertPopup('\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u043d\u043e\u043c\u0435\u0440 \u0434\u043e\u043c\u0430.'); rhi?.focus(); return; }

    const man = ($('reg-addr-manual')?.value || '').trim();
    const shop = ($('reg-addr-shop')?.value || '').trim();
    let addr = rni?.value.trim() || man || [city, street, house].filter(Boolean).join(', ');
    if (addr && shop) addr = shop + ' \u2014 ' + addr;
    _regData.address = addr;
    _regData.shopName = shop || '';

    // Duplicate check for legal by address
    if (_regData.type === 'legal' && addr) {
      const btn = $('btn-reg2-next');
      const origT = btn?.textContent || '\u0414\u0430\u043b\u0435\u0435 \u2192';
      if (btn) { btn.disabled = true; btn.textContent = '\u23f3 \u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430\u2026'; }
      try {
        const dupMsg = await _checkDuplicateClient({ type: 'legal', address: addr });
        if (dupMsg) {
          if (btn) { btn.disabled = false; btn.textContent = origT; }
          shakeField(rhi);
          showAlertPopup(dupMsg + '\n\n\u041a\u043b\u0438\u0435\u043d\u0442 \u0441 \u0442\u0430\u043a\u0438\u043c \u0430\u0434\u0440\u0435\u0441\u043e\u043c \u0443\u0436\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442.',
            { title: '\u0410\u0434\u0440\u0435\u0441 \u0443\u0436\u0435 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u043d', icon: '\ud83d\udccd' });
          return;
        }
      } catch (e) { console.warn('Address duplicate check failed:', e); }
      if (btn) { btn.disabled = false; btn.textContent = origT; }
    }

    clearMsg('auth-msg-reg2');
    window._codeShowStep('code-step-reg3');
    _buildRequestText();
  });

  // Back buttons for reg steps
  $('btn-reg2-back')?.addEventListener('click', () => {
    window._codeShowStep('code-step-reg1');
    if (_regData._legalLocked) _applyLegalLock();
  });

  $('btn-reg3-back')?.addEventListener('click', () => window._codeShowStep('code-step-reg2'));

  $('btn-reg3-done')?.addEventListener('click', () => {
    closeOverlay('auth-code-overlay');
    window._codeShowStep('code-step-0');
  });

  // Copy buttons
  window._copyPhone = () => {
    navigator.clipboard.writeText(MANAGER_PHONE).then(() => {
      const btn = $('btn-copy-phone');
      if (btn) { btn.textContent = '\u2713 \u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u043e!'; setTimeout(() => { btn.textContent = '\u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043d\u043e\u043c\u0435\u0440'; }, 2000); }
    });
  };
  window._copyRequest = () => {
    navigator.clipboard.writeText(_regData._requestText || '').then(() => {
      const btn = $('btn-copy-request');
      if (btn) { btn.textContent = '\u2713 \u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u043e!'; setTimeout(() => { btn.textContent = '\u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0442\u0435\u043a\u0441\u0442'; }, 2000); }
    });
  };
}
