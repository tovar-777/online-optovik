/**
 * Auth Modal Component
 * Handles code-based login, guest mode, logout, and overlay management.
 */

import { sb } from '@shared/lib/supabase.js';
import { $ } from '@shared/lib/utils.js';
import { getCart, setCart, setDraftOrderId, syncStatus, updateCartDisplay, loadCartFromLocalStorage, saveCartToLocalStorage, cartStorageKey } from '../state/cart.js';
import { renderProducts } from './Catalog.js';

// ── Overlay helpers ────────────────────────────────────────
export function openOverlay(id) {
  const el = $(id);
  if (el) el.classList.add('active');
}

export function closeOverlay(id) {
  const el = $(id);
  if (el) el.classList.remove('active');
}

// ── Message helpers ────────────────────────────────────────
export function showMsg(id, text, type) {
  const el = $(id);
  if (!el) return;
  el.className = 'auth-message ' + type;
  el.textContent = text;
}

export function clearMsg(id) {
  const el = $(id);
  if (el) { el.className = 'auth-message'; el.textContent = ''; }
}

export function setBusy(id, busy, label) {
  const btn = $(id);
  if (!btn) return;
  btn.disabled = busy;
  if (busy) { btn.textContent = '\u041f\u043e\u0434\u043e\u0436\u0434\u0438\u0442\u0435\u2026'; btn.classList.add('loading'); }
  else { btn.textContent = label; btn.classList.remove('loading'); }
}

export function shakeField(inputEl) {
  if (!inputEl) return;
  inputEl.classList.remove('field-error');
  void inputEl.offsetWidth;
  inputEl.classList.add('field-error');
  inputEl.addEventListener('input', function clear() {
    inputEl.classList.remove('field-error');
    inputEl.removeEventListener('input', clear);
  }, { once: true });
}

export function showAlertPopup(text, opts) {
  opts = opts || {};
  const overlay = $('reg-alert-overlay');
  const textEl = $('reg-alert-text');
  const titleEl = $('reg-alert-title');
  const iconEl = $('reg-alert-icon');
  const okBtn = $('reg-alert-ok');
  const secondBtn = $('reg-alert-second');
  if (!overlay) return;

  if (titleEl) titleEl.textContent = opts.title || '\u041a\u043b\u0438\u0435\u043d\u0442 \u0443\u0436\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442';
  if (iconEl) iconEl.textContent = opts.icon || '\u26a0\ufe0f';
  if (textEl) textEl.textContent = text;
  if (okBtn) okBtn.textContent = opts.okLabel || '\u041f\u043e\u043d\u044f\u0442\u043d\u043e';
  if (secondBtn) {
    if (opts.secondLabel) { secondBtn.textContent = opts.secondLabel; secondBtn.style.display = 'block'; }
    else secondBtn.style.display = 'none';
  }

  overlay.classList.add('active');

  function closeAlert() {
    overlay.classList.remove('active');
    okBtn?.removeEventListener('click', closeAlert);
    secondBtn?.removeEventListener('click', onSecond);
    overlay.removeEventListener('click', onBgClick);
  }
  function onSecond() { closeAlert(); if (opts.onSecond) opts.onSecond(); }
  function onBgClick(e) { if (e.target === overlay) closeAlert(); }

  okBtn?.addEventListener('click', closeAlert);
  if (opts.secondLabel) secondBtn?.addEventListener('click', onSecond);
  overlay.addEventListener('click', onBgClick);
  setTimeout(() => (opts.secondLabel ? secondBtn : okBtn)?.focus(), 50);
}

// ── Captcha ────────────────────────────────────────────────
let _captchaSolved = false;

function buildCaptcha() {
  const row = $('login-captcha-row');
  const msg = $('login-captcha-msg');
  if (!row) return;
  _captchaSolved = false;
  row.innerHTML = '';
  if (msg) msg.textContent = '';

  const target = Math.floor(Math.random() * 9) + 1;
  const prompt = $('login-captcha-wrap')?.querySelector('div:first-child');
  if (prompt) prompt.textContent = `\u041d\u0430\u0436\u043c\u0438\u0442\u0435 \u043d\u0430 \u0446\u0438\u0444\u0440\u0443 ${target}:`;

  const nums = [target];
  while (nums.length < 5) {
    const n = Math.floor(Math.random() * 9) + 1;
    if (!nums.includes(n)) nums.push(n);
  }
  nums.sort(() => Math.random() - 0.5);

  nums.forEach(n => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = n;
    btn.style.cssText = 'width:40px;height:40px;border-radius:10px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.06);color:#fff;font-size:1.1rem;cursor:pointer';
    btn.addEventListener('click', () => {
      if (n === target) {
        _captchaSolved = true;
        if (msg) { msg.style.color = '#4caf50'; msg.textContent = '\u2713'; }
        $('login-captcha-wrap') && ($('login-captcha-wrap').style.display = 'none');
      } else {
        if (msg) { msg.style.color = '#ff6b6b'; msg.textContent = '\u041d\u0435\u0432\u0435\u0440\u043d\u043e, \u043f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0451'; }
        buildCaptcha();
      }
    });
    row.appendChild(btn);
  });
}

// ── onAuthSuccess ──────────────────────────────────────────
export function onAuthSuccess(user, profile, mode) {
  try {
    if (user) {
      const myKey = 'cart_' + user.id;
      const legacyCart = localStorage.getItem('cart');
      if (legacyCart && !localStorage.getItem(myKey)) localStorage.removeItem('cart');
    }
  } catch (e) {}

  window.currentUser = user;
  window.currentProfile = profile;

  // Badge in topbar
  const infoEl = $('splash-user-info');
  if (infoEl) {
    const name = (profile && profile.name) || (user && user.email) || window.codeUserName || '\u0413\u043e\u0441\u0442\u044c';
    const initials = name.substring(0, 2).toUpperCase();
    infoEl.innerHTML =
      '<div class="splash-user-badge">' +
      '  <div class="badge-avatar">' + initials + '</div>' +
      '  <span>' + name + '</span>' +
      '  <button class="badge-logout" onclick="window.doLogout()">\u0412\u044b\u0439\u0442\u0438</button>' +
      '</div>';
  }

  const authCtrl = $('splash-auth-controls');
  const enterCtrl = $('splash-enter-controls');
  if (authCtrl) authCtrl.style.display = 'none';
  if (enterCtrl) enterCtrl.style.display = 'flex';

  const loggedAs = $('splash-logged-as');
  if (loggedAs) {
    if (window.isGuestMode) loggedAs.textContent = '\u0420\u0435\u0436\u0438\u043c \u0433\u043e\u0441\u0442\u044f \u2014 \u0437\u0430\u043a\u0430\u0437\u044b \u0441\u043e\u0445\u0440\u0430\u043d\u044f\u0442\u044c\u0441\u044f \u043d\u0435 \u0431\u0443\u0434\u0443\u0442';
    else if (window.isCodeMode) loggedAs.textContent = '\ud83d\udd11 \u0412\u0445\u043e\u0434 \u043f\u043e \u043b\u0438\u0447\u043d\u043e\u043c\u0443 \u043a\u043e\u0434\u0443';
    else loggedAs.textContent = '\u2713 ' + (user && user.email ? user.email : '');
  }

  if (typeof window._profileUpdateHeader === 'function') window._profileUpdateHeader();

  if (window.appDataLoaded) {
    const enterBtn = $('splash-enter-btn');
    if (enterBtn) enterBtn.disabled = false;
  }

  if (!window.isGuestMode) {
    const fab = $('my-orders-fab');
    if (fab) fab.classList.add('visible');
  }

  // Restore cart for email users
  if (user && !window.isGuestMode && !window.isCodeMode) {
    localStorage.removeItem('cart');
    try {
      const sid = localStorage.getItem('_draftId');
      if (sid) setDraftOrderId(sid);
    } catch (e) {}
    loadCartFromLocalStorage();
    updateCartDisplay();
    try { renderProducts(); } catch (e) {}
  }

  // Restore cart for code users
  if (window.isCodeMode && window.codeSession) {
    localStorage.removeItem('cart');
    const key = cartStorageKey();
    let hasLocalCart = false;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Object.keys(parsed).length > 0) hasLocalCart = true;
      }
    } catch (e) {}

    if (hasLocalCart) {
      try {
        const sid = localStorage.getItem('_draftId');
        if (sid) setDraftOrderId(sid);
      } catch (e) {}
      loadCartFromLocalStorage();
      updateCartDisplay();
      try { renderProducts(); } catch (e) {}
    } else {
      setCart({});
      updateCartDisplay();
    }
  }

  // Switch confirm/copy buttons
  const confirmBtn = document.getElementById('btn-confirm-order');
  const copyBtn = document.getElementById('btn-copy-only');
  if ((user || mode === 'code') && !window.isGuestMode) {
    if (confirmBtn) confirmBtn.style.display = 'block';
    if (copyBtn) copyBtn.style.display = 'none';
  } else {
    if (confirmBtn) confirmBtn.style.display = 'none';
    if (copyBtn) copyBtn.style.display = 'block';
  }
}

window._onAuthSuccess = onAuthSuccess;

// ── Logout ─────────────────────────────────────────────────
export async function doLogout() {
  const isSaving = document.getElementById('cart-toggle-btn')?.classList.contains('saving');
  if (isSaving) {
    if (!confirm('\u0417\u0430\u043a\u0430\u0437 \u0435\u0449\u0451 \u0441\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u0442\u0441\u044f. \u0412\u044b\u0439\u0442\u0438 \u0441\u0435\u0439\u0447\u0430\u0441 \u2014 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f \u043c\u043e\u0433\u0443\u0442 \u043d\u0435 \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c\u0441\u044f. \u041f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u0442\u044c?')) return;
  }

  if (window.currentUser) localStorage.removeItem('cart_' + window.currentUser.id);
  localStorage.removeItem('cart');

  try {
    if (window.isCodeMode && window.codeSession) localStorage.removeItem('cart_code_' + window.codeSession.id);
    if (window.currentUser) localStorage.removeItem('cart_' + window.currentUser.id);
    localStorage.removeItem('_draftId');
    localStorage.removeItem('_codeSession');
    localStorage.removeItem('cart');
  } catch (e) {}

  setCart({});
  setDraftOrderId(null);
  window.codeSession = null;
  syncStatus('none');
  updateCartDisplay();
  try { renderProducts(); } catch (e) {}

  await sb.auth.signOut();
  window.currentUser = null;
  window.currentProfile = null;
  window.isGuestMode = false;
  window.isCodeMode = false;

  const cb = document.getElementById('btn-confirm-order');
  const cy = document.getElementById('btn-copy-only');
  if (cb) cb.style.display = 'none';
  if (cy) cy.style.display = 'block';

  const infoEl = $('splash-user-info');
  if (infoEl) infoEl.innerHTML = '<div style="font-size:0.68rem;font-weight:600;color:rgba(255,255,255,0.3);letter-spacing:0.07em;border:1px solid rgba(255,255,255,0.09);padding:3px 10px;border-radius:99px;">\u041e\u043f\u0442\u043e\u0432\u0430\u044f \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u0430</div>';

  const authCtrl = $('splash-auth-controls');
  const enterCtrl = $('splash-enter-controls');
  if (authCtrl) authCtrl.style.display = 'flex';
  if (enterCtrl) enterCtrl.style.display = 'none';

  const enterBtn = $('splash-enter-btn');
  if (enterBtn) enterBtn.disabled = true;

  const splash = $('splash-screen');
  const app = $('app-content');
  if (splash) { splash.classList.remove('hidden', 'exit'); splash.style.display = ''; }
  if (app) app.classList.remove('visible');

  const fab = $('my-orders-fab');
  if (fab) fab.classList.remove('visible');
}

window.doLogout = doLogout;

// ── Guest mode helpers ─────────────────────────────────────
window._showGuestConfirm = function () {
  const b = document.getElementById('guest-confirm-banner');
  if (b) b.style.display = 'flex';
};
window._hideGuestConfirm = function () {
  const b = document.getElementById('guest-confirm-banner');
  if (b) b.style.display = 'none';
};
window._guestExit = function () {
  window._hideGuestConfirm();
  const appContent = document.getElementById('app-content');
  const splash = document.getElementById('splash-screen');
  if (appContent) appContent.classList.remove('visible');
  if (splash) { splash.classList.remove('hidden', 'exit'); splash.style.display = ''; }
  window.isGuestMode = false;
  setCart({});
  updateCartDisplay();
  try { localStorage.removeItem('cart'); localStorage.removeItem('cart_guest'); } catch (e) {}
  const gfab = document.getElementById('guest-fab');
  if (gfab) gfab.style.display = 'none';
};

// ── Fetch profile ──────────────────────────────────────────
export async function fetchProfile(userId) {
  try {
    const { data } = await sb.from('user_profiles').select('*').eq('user_id', userId).single();
    return data;
  } catch (e) { return null; }
}

// ── Init Auth Listeners ────────────────────────────────────
export function initAuthListeners() {
  const btnCode = $('btn-auth-code');
  const btnGuest = $('btn-auth-guest');
  const closeCode = $('auth-code-close');

  if (btnCode) btnCode.addEventListener('click', () => openOverlay('auth-code-overlay'));
  if (closeCode) closeCode.addEventListener('click', () => { closeOverlay('auth-code-overlay'); codeShowStep('code-step-0'); });

  // Guest mode
  if (btnGuest) btnGuest.addEventListener('click', () => {
    window.isGuestMode = true;
    window.isCodeMode = false;
    window.currentUser = null;
    const splash = document.getElementById('splash-screen');
    const appContent = document.getElementById('app-content');
    if (splash) { splash.classList.add('hidden'); splash.style.display = 'none'; }
    if (appContent) appContent.classList.add('visible');
    if (typeof window.initApp === 'function') window.initApp();
    setTimeout(() => {
      const gfab = document.getElementById('guest-fab');
      if (gfab) gfab.style.display = 'flex';
    }, 600);
  });

  // Step navigation
  const allSteps = ['code-step-0', 'code-step-login', 'code-step-reg1', 'code-step-reg2', 'code-step-reg3'];

  function codeShowStep(id) {
    allSteps.forEach(s => { const el = $(s); if (el) el.style.display = 'none'; });
    const t = $(id); if (t) t.style.display = '';
  }
  window._codeShowStep = codeShowStep;
  codeShowStep('code-step-0');

  $('btn-go-login')?.addEventListener('click', () => codeShowStep('code-step-login'));
  $('btn-go-register')?.addEventListener('click', () => codeShowStep('code-step-reg1'));
  $('btn-login-back')?.addEventListener('click', () => codeShowStep('code-step-0'));

  // Paste code button
  $('btn-paste-code')?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      const code = text.replace(/\D/g, '').slice(0, 5);
      const input = $('login-code');
      if (input && code) input.value = code;
    } catch (e) {}
  });

  // Code login
  $('btn-do-code-login')?.addEventListener('click', async () => {
    const now = Date.now();
    const blocked = parseInt(localStorage.getItem('_lb') || '0');
    if (now < blocked) {
      const mins = Math.ceil((blocked - now) / 60000);
      showMsg('auth-msg-login', '\u0421\u043b\u0438\u0448\u043a\u043e\u043c \u043c\u043d\u043e\u0433\u043e \u043f\u043e\u043f\u044b\u0442\u043e\u043a. \u041f\u043e\u0434\u043e\u0436\u0434\u0438\u0442\u0435 ' + mins + ' \u043c\u0438\u043d.', 'error');
      return;
    }

    const code = ($('login-code')?.value || '').trim();
    if (!/^\d{5}$/.test(code)) { showMsg('auth-msg-login', '\u041a\u043e\u0434 \u2014 5 \u0446\u0438\u0444\u0440', 'error'); return; }

    let attempts = parseInt(localStorage.getItem('_la') || '0');
    if (attempts >= 3 && !_captchaSolved) {
      const wrap = $('login-captcha-wrap');
      if (wrap) wrap.style.display = 'block';
      buildCaptcha();
      showMsg('auth-msg-login', '\u041f\u0440\u043e\u0439\u0434\u0438\u0442\u0435 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0443', 'error');
      return;
    }

    setBusy('btn-do-code-login', true);
    clearMsg('auth-msg-login');

    try {
      const res = await sb.rpc('check_client_code_only', { p_code: code });
      if (res.error) throw res.error;
      const d = res.data;
      if (!d || !d.ok) {
        attempts++;
        localStorage.setItem('_la', attempts);
        if (attempts >= 5) { localStorage.setItem('_lb', Date.now() + 15 * 60 * 1000); localStorage.setItem('_la', '0'); }
        if (attempts >= 3) {
          const wrap = $('login-captcha-wrap');
          if (wrap) wrap.style.display = 'block';
          buildCaptcha();
          _captchaSolved = false;
        }
        throw new Error('\u041d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 \u0442\u0435\u043b\u0435\u0444\u043e\u043d \u0438\u043b\u0438 \u043a\u043e\u0434. \u041f\u043e\u043f\u044b\u0442\u043a\u0430 ' + attempts + ' \u0438\u0437 5.');
      }

      localStorage.setItem('_la', '0');

      // Clear previous session draft if different client
      let prevSess = null;
      try { prevSess = JSON.parse(localStorage.getItem('_codeSession') || 'null'); } catch (e) {}
      if (prevSess && prevSess.id !== d.id) {
        setDraftOrderId(null);
        try { localStorage.removeItem('_draftId'); } catch (e) {}
        try { if (prevSess.id) localStorage.removeItem('cart_code_' + prevSess.id); } catch (e) {}
        setCart({});
      }

      const sess = { id: d.id, name: d.name, type: d.type, phone: d.phone, email: d.email, delivery_address: d.delivery_address };
      localStorage.setItem('_codeSession', JSON.stringify(sess));
      window.isCodeMode = true;
      window.codeUserName = d.name;
      window.codeSession = sess;

      closeOverlay('auth-code-overlay');
      codeShowStep('code-step-0');
      onAuthSuccess(null, { name: d.name }, 'code');

      if (window.appDataLoaded) {
        const eb = $('splash-enter-btn');
        if (eb) eb.disabled = false;
      }
    } catch (e) {
      showMsg('auth-msg-login', e.message || '\u041e\u0448\u0438\u0431\u043a\u0430 \u0432\u0445\u043e\u0434\u0430', 'error');
    } finally {
      setBusy('btn-do-code-login', false, '\u0412\u043e\u0439\u0442\u0438');
    }
  });
}
