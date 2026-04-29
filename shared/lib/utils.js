// ── HTML escaping (XSS prevention) ──────────────────────────
export function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Price formatting ────────────────────────────────────────
export function formatPrice(price) {
  return parseFloat(price).toFixed(1);
}

// ── Relative time (Russian) ─────────────────────────────────
export function formatTimeAgo(timestamp) {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  if (diffDays === 0) return `сегодня ${hours}:${minutes}`;
  if (diffDays === 1) return `вчера ${hours}:${minutes}`;
  if (diffDays === 2) return `позавчера ${hours}:${minutes}`;
  if (diffDays < 7) return `${diffDays} дней назад ${hours}:${minutes}`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} ${weeks === 1 ? 'неделю' : weeks < 5 ? 'недели' : 'недель'} назад`;
  }
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

export function getTimeDescription(timestamp) {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'сегодня';
  if (diffDays === 1) return 'вчера';
  if (diffDays === 2) return 'позавчера';
  if (diffDays < 7) return `${diffDays} дней назад`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} ${weeks === 1 ? 'неделю' : weeks < 5 ? 'недели' : 'недель'} назад`;
  }
  const months = Math.floor(diffDays / 30);
  return `${months} ${months === 1 ? 'месяц' : months < 5 ? 'месяца' : 'месяцев'} назад`;
}

// ── DOM shortcuts ───────────────────────────────────────────
export function $(id) {
  return document.getElementById(id);
}

export function $0(sel) {
  return document.querySelector(sel);
}

// ── Cart storage key (user-specific) ────────────────────────
export function cartStorageKey(session) {
  if (session && session.id) return `cart_code_${session.id}`;
  return 'cart_guest';
}
