/**
 * Catalog Component
 * Renders product catalog with filtering, grouping, sorting, and brand navigation.
 */

import { formatPrice } from '@shared/lib/utils.js';
import { getFilterIcons, formatProductInfo } from '@shared/services/products.js';
import { getCart, getProducts, updateCart, removeProductFromCart, saveCartToLocalStorage, scheduleDraftSave } from '../state/cart.js';

// ── Constants ──────────────────────────────────────────────
export const DEFAULT_IMAGE = 'https://avatars.mds.yandex.net/get-goods_pic/6237136/hate63d296869e8859dc9057fee2a34e27e/square_166';

export const FILTER_IMAGES = {
  promo: '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="#e07800" viewBox="0 0 256 256"><path d="M96,104a8,8,0,1,1,8-8A8,8,0,0,1,96,104Zm64,48a8,8,0,1,0,8,8A8,8,0,0,0,160,152Zm80-24c0,10.44-7.51,18.27-14.14,25.18-3.77,3.94-7.67,8-9.14,11.57-1.36,3.27-1.44,8.69-1.52,13.94-.15,9.76-.31,20.82-8,28.51s-18.75,7.85-28.51,8c-5.25.08-10.67.16-13.94,1.52-3.57,1.47-7.63,5.37-11.57,9.14C146.27,232.49,138.44,240,128,240s-18.27-7.51-25.18-14.14c-3.94-3.77-8-7.67-11.57-9.14-3.27-1.36-8.69-1.44-13.94-1.52-9.76-.15-20.82-.31-28.51-8s-7.85-18.75-8-28.51c-.08-5.25-.16-10.67-1.52-13.94-1.47-3.57-5.37-7.63-9.14-11.57C23.51,146.27,16,138.44,16,128s7.51-18.27,14.14-25.18c3.77-3.94,7.67-8,9.14-11.57,1.36-3.27,1.44-8.69,1.52-13.94.15-9.76.31-20.82,8-28.51s18.75-7.85,28.51-8c5.25-.08,10.67-.16,13.94-1.52,3.57-1.47,7.63-5.37,11.57-9.14C109.73,23.51,117.56,16,128,16s18.27,7.51,25.18,14.14c3.94,3.77,8,7.67,11.57,9.14,3.27,1.36,8.69,1.44,13.94,1.52,9.76.15,20.82.31,28.51,8s7.85,18.75,8,28.51c.08,5.25.16,10.67,1.52,13.94,1.47,3.57,5.37,7.63,9.14,11.57C232.49,109.73,240,117.56,240,128ZM96,120A24,24,0,1,0,72,96,24,24,0,0,0,96,120Zm77.66-26.34a8,8,0,0,0-11.32-11.32l-80,80a8,8,0,0,0,11.32,11.32ZM184,160a24,24,0,1,0-24,24A24,24,0,0,0,184,160Z"></path></svg>',
  new: '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="#1565c0" viewBox="0 0 256 256"><path d="M128,56H112V16a8,8,0,0,1,16,0Zm64,67.62V72a16,16,0,0,0-16-16H128v60.69l18.34-18.35a8,8,0,0,1,11.32,11.32l-32,32a8,8,0,0,1-11.32,0l-32-32A8,8,0,0,1,93.66,98.34L112,116.69V56H64A16,16,0,0,0,48,72V200a8,8,0,0,0,8,8h74.7c.32.67.67,1.34,1.05,2l.24.38,22.26,34a8,8,0,0,0,13.39-8.76l-22.13-33.79A12,12,0,0,1,166.4,190c.07.13.15.26.23.38l10.68,16.31A8,8,0,0,0,192,202.31V144a74.84,74.84,0,0,1,24,54.69V240a8,8,0,0,0,16,0V198.65A90.89,90.89,0,0,0,192,123.62Z"></path></svg>',
  arrival: '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="#1b5e20" viewBox="0 0 256 256"><path d="M188,120,128,80l55.56-37a8,8,0,0,1,8.88,0L238,73.34a8,8,0,0,1,0,13.32ZM72.44,43a8,8,0,0,0-8.88,0L18,73.34a8,8,0,0,0,0,13.32L68,120l60-40ZM238,153.34,188,120l-60,40,55.56,37a8,8,0,0,0,8.88,0L238,166.66A8,8,0,0,0,238,153.34Zm-220,0a8,8,0,0,0,0,13.32L63.56,197a8,8,0,0,0,8.88,0L128,160,68,120Zm150.61,52.95-38.37-25.58a4,4,0,0,0-4.44,0L87.41,206.29a4,4,0,0,0,0,6.65L123.56,237a8,8,0,0,0,8.88,0l36.15-24.1A4,4,0,0,0,168.59,206.29Z"></path></svg>',
  actual: '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="#c62828" viewBox="0 0 256 256"><path d="M176,232a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h80A8,8,0,0,1,176,232Zm40-128a87.55,87.55,0,0,1-33.64,69.21A16.24,16.24,0,0,0,176,186v6a16,16,0,0,1-16,16H96a16,16,0,0,1-16-16v-6a16,16,0,0,0-6.23-12.66A87.59,87.59,0,0,1,40,104.49C39.74,56.83,78.26,17.14,125.88,16A88,88,0,0,1,216,104Zm-32.11-9.34a57.6,57.6,0,0,0-46.56-46.55,8,8,0,0,0-2.66,15.78c16.57,2.79,30.63,16.85,33.44,33.45A8,8,0,0,0,176,104a9,9,0,0,0,1.35-.11A8,8,0,0,0,183.89,94.66Z"></path></svg>',
  child: '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="#e91e8c" viewBox="0 0 256 256"><path d="M134.16,24.1a4,4,0,0,0-3.56,1.81C120.3,41.48,120,55.79,120,56a8,8,0,0,0,9.68,7.79A8.24,8.24,0,0,0,136,55.68,8,8,0,0,1,144.8,48a8.14,8.14,0,0,1,7.2,8.23,24,24,0,0,1-48-.27c0-.63.09-10.78,5.44-24a4,4,0,0,0-4.59-5.39A104.16,104.16,0,0,0,24.07,131.66C26,186.72,71.23,231,126.32,231.9a104,104,0,0,0,7.84-207.8ZM80,127.91a12,12,0,1,1,12,12A12,12,0,0,1,80,127.91Zm80.27,54.77a61,61,0,0,1-64.54,0,8,8,0,0,1,8.54-13.54,45,45,0,0,0,47.46,0,8,8,0,0,1,8.54,13.54ZM164,139.91a12,12,0,1,1,12-12A12,12,0,0,1,164,139.91Z"></path></svg>',
  discount: '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="#666" viewBox="0 0 256 256"><path d="M225.86,102.82c-3.77-3.94-7.67-8-9.14-11.57-1.36-3.27-1.44-8.69-1.52-13.94-.15-9.76-.31-20.82-8-28.51s-18.75-7.85-28.51-8c-5.25-.08-10.67-.16-13.94-1.52-3.56-1.47-7.63-5.37-11.57-9.14C146.28,23.51,138.44,16,128,16s-18.27,7.51-25.18,14.14c-3.94,3.77-8,7.67-11.57,9.14C88,40.64,82.56,40.72,77.31,40.8c-9.76.15-20.82.31-28.51,8S41,67.55,40.8,77.31c-.08,5.25-.16,10.67-1.52,13.94-1.47,3.56-5.37,7.63-9.14,11.57C23.51,109.72,16,117.56,16,128s7.51,18.27,14.14,25.18c3.77,3.94,7.67,8,9.14,11.57,1.36,3.27,1.44,8.69,1.52,13.94.15,9.76.31,20.82,8,28.51s18.75,7.85,28.51,8c5.25.08,10.67.16,13.94,1.52,3.56,1.47,7.63,5.37,11.57,9.14C109.72,232.49,117.56,240,128,240s18.27-7.51,25.18-14.14c3.94-3.77,8-7.67,11.57-9.14,3.27-1.36,8.69-1.44,13.94-1.52,9.76-.15,20.82-.31,28.51-8s7.85-18.75,8-28.51c.08-5.25.16-10.67,1.52-13.94,1.47-3.56,5.37-7.63,9.14-11.57C232.49,146.28,240,138.44,240,128S232.49,109.73,225.86,102.82ZM120,80a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm8,104a12,12,0,1,1,12-12A12,12,0,0,1,128,184Z"></path></svg>',
};

export const BUTTON_IMAGES = {
  plus: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#54a512" viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.13,104.13,0,0,0,128,24Zm40,112H136v32a8,8,0,0,1-16,0V136H88a8,8,0,0,1,0-16h32V88a8,8,0,0,1,16,0v32h32a8,8,0,0,1,0,16Z"></path></svg>',
  minus: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#d32f2f" viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm40,112H88a8,8,0,0,1,0-16h80a8,8,0,0,1,0,16Z"></path></svg>',
  delete: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#9d1531" viewBox="0 0 256 256"><path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM112,168a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm0-120H96V40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8Z"></path></svg>',
  commentEmpty: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#0e0104" viewBox="0 0 256 256"><path d="M138,128a10,10,0,1,1-10-10A10,10,0,0,1,138,128ZM84,118a10,10,0,1,0,10,10A10,10,0,0,0,84,118Zm88,0a10,10,0,1,0,10,10A10,10,0,0,0,172,118Zm58-54V192a14,14,0,0,1-14,14H82.23L49.07,234.64l-.06.05A13.87,13.87,0,0,1,40,238a14.11,14.11,0,0,1-5.95-1.33A13.88,13.88,0,0,1,26,224V64A14,14,0,0,1,40,50H216A14,14,0,0,1,230,64Zm-12,0a2,2,0,0,0-2-2H40a2,2,0,0,0-2,2V224a2,2,0,0,0,3.26,1.55l34.82-30.08A6,6,0,0,1,80,194H216a2,2,0,0,0,2-2Z"></path></svg>',
  commentFilled: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#b9acaf" viewBox="0 0 256 256"><path d="M216,48H40A16,16,0,0,0,24,64V224a15.84,15.84,0,0,0,9.25,14.5A16.05,16.05,0,0,0,40,240a15.89,15.89,0,0,0,10.25-3.78l.09-.07L83,208H216a16,16,0,0,0,16-16V64A16,16,0,0,0,216,48ZM84,140a12,12,0,1,1,12-12A12,12,0,0,1,84,140Zm44,0a12,12,0,1,1,12-12A12,12,0,0,1,128,140Zm44,0a12,12,0,1,1,12-12A12,12,0,0,1,172,140Z"></path></svg>',
};

// ── Sort SVG Icons ─────────────────────────────────────────
const SORT_SVG_PRICE = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#464743" viewBox="0 0 256 256"><path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,72h40a8,8,0,0,1,0,16H72a8,8,0,0,1,0-16Zm0,48h48a8,8,0,0,1,0,16H72a8,8,0,0,1,0-16Zm96,64H72a8,8,0,0,1,0-16h96a8,8,0,0,1,0,16Zm29.66-82.34a8,8,0,0,1-11.32,0L176,91.31V136a8,8,0,0,1-16,0V91.31l-10.34,10.35a8,8,0,0,1-11.32-11.32l24-24a8,8,0,0,1,11.32,0l24,24A8,8,0,0,1,197.66,101.66Z" transform="rotate(-90 128 128)"></path></svg>';
const SORT_SVG_BRAND = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#464743" viewBox="0 0 256 256"><path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,72h96a8,8,0,0,1,0,16H72a8,8,0,0,1,0-16Zm40,112H72a8,8,0,0,1,0-16h40a8,8,0,0,1,0,16Zm8-48H72a8,8,0,0,1,0-16h48a8,8,0,0,1,0,16Zm77.66,29.66-24,24a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L160,164.69V120a8,8,0,0,1,16,0v44.69l10.34-10.35a8,8,0,0,1,11.32,11.32Z" transform="rotate(-90 128 128)"></path></svg>';

// ── Catalog State ──────────────────────────────────────────
let selectedGroup = null;
let currentFilters = [];
let selectedBrands = [];
let searchQuery = '';
let expandedTags = {};
let tagSortMode = {};
let _subgroupScrollListener = null;

// ── State Getters / Setters ────────────────────────────────
export function getSelectedGroup() { return selectedGroup; }
export function setSelectedGroup(g) { selectedGroup = g; }
export function getCurrentFilters() { return currentFilters; }
export function getSelectedBrands() { return selectedBrands; }
export function getSearchQuery() { return searchQuery; }
export function setSearchQuery(q) { searchQuery = q; }
export function getExpandedTags() { return expandedTags; }
export function getTagSortMode() { return tagSortMode; }

// ── Helpers ────────────────────────────────────────────────

/** Returns true if product passes all active filters/brands/search */
function productPassesFilters(product) {
  const dopValue = product.dop || '';
  const nameValue = product.name || '';
  if (currentFilters.length > 0) {
    let passes = false;
    if (currentFilters.includes('promo') && (dopValue.includes('\u0430\u043a\u0446\u0438\u044f!!!') || dopValue.includes('\u0440\u0430\u0441\u043f\u0440\u043e\u0434\u0430\u0436\u0430!!!'))) passes = true;
    if (currentFilters.includes('new') && nameValue.includes('\ud83c\udd95')) passes = true;
    if (currentFilters.includes('arrival') && dopValue.includes('\u043f\u043e\u0441\u0442\u0443\u043f\u043b\u0435\u043d\u0438\u0435')) passes = true;
    if (currentFilters.includes('actual') && dopValue.includes('\u0430\u043a\u0442\u0443\u0430\u043b\u044c\u043d\u043e')) passes = true;
    if (currentFilters.includes('child') && dopValue.toLowerCase().includes('\u0434\u0435\u0442\u0441\u043a\u043e\u0435')) passes = true;
    if (currentFilters.includes('discount') && dopValue.toLowerCase().includes('\u0443\u0446\u0435\u043d\u043a\u0430')) passes = true;
    if (!passes) return false;
  }
  if (selectedBrands.length > 0 && !selectedBrands.includes(product.brand || '\u0411\u0435\u0437 \u0431\u0440\u0435\u043d\u0434\u0430')) return false;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    if (!nameValue.toLowerCase().includes(q) && !(product.brand || '').toLowerCase().includes(q)) return false;
  }
  return true;
}

/** True if ANY active filter/brand/search is set */
function hasActiveFiltering() {
  return currentFilters.length > 0 || selectedBrands.length > 0 || !!searchQuery;
}

/** Returns true if group has products matching active filters */
function groupHasFilteredProducts(group) {
  if (!hasActiveFiltering()) return true;
  return getProducts().some(p => p.group === group && productPassesFilters(p));
}

/** Returns true if subgroup has products matching active filters (within selectedGroup) */
function subgroupHasFilteredProducts(subgroup) {
  if (!hasActiveFiltering()) return true;
  return getProducts().some(p =>
    p.group === selectedGroup &&
    (p.subgroup || '\u0411\u0435\u0437 \u043f\u043e\u0434\u0433\u0440\u0443\u043f\u043f\u044b') === subgroup &&
    productPassesFilters(p)
  );
}

/** Update dim state on group/subgroup buttons without re-creating them */
export function updateGroupDimming() {
  document.querySelectorAll('.group-filter-btn[data-group]').forEach(btn => {
    btn.classList.toggle('dimmed', !groupHasFilteredProducts(btn.dataset.group));
  });
  document.querySelectorAll('.subgroup-filter-btn[data-subgroup]').forEach(btn => {
    btn.classList.toggle('dimmed', !subgroupHasFilteredProducts(btn.dataset.subgroup));
  });
}

function safeString(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

export function makeProductsSafe(products) {
  return products.map(p => ({
    ...p,
    dop: safeString(p.dop),
    name: safeString(p.name),
    brand: safeString(p.brand) || '\u0411\u0435\u0437 \u0431\u0440\u0435\u043d\u0434\u0430',
    text: safeString(p.text),
    info: safeString(p.info),
    cartName: safeString(p.cartName) || safeString(p.name),
    unit: safeString(p.unit),
    tag: safeString(p.tag),
    group: safeString(p.group),
    subgroup: safeString(p.subgroup),
    image: p.image || DEFAULT_IMAGE,
  }));
}

function highlightText(text, query) {
  if (!text || !query) return text || '';
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return text.replace(regex, '<span class="highlight">$1</span>');
}

// ── Product Card ───────────────────────────────────────────
export function createProductCard(product) {
  const cart = getCart();
  const card = document.createElement('div');
  card.className = 'product-card';

  if (product.dop.includes('\u0430\u043a\u0446\u0438\u044f!!!') || product.dop.includes('\u0440\u0430\u0441\u043f\u0440\u043e\u0434\u0430\u0436\u0430!!!')) {
    card.classList.add('promo');
  }

  const cartItem = cart[product.id];
  const quantity = cartItem ? cartItem.quantity : 0;
  if (quantity > 0) card.classList.add('ordered');

  let highlightedName = product.name;
  if (searchQuery) highlightedName = highlightText(product.name, searchQuery);

  const filterIcons = getFilterIcons(product, FILTER_IMAGES);
  let filterIconsPreviewHTML = '';
  let filterIconsExpandedHTML = '';

  if (filterIcons.length > 0) {
    filterIconsPreviewHTML = '<div class="filter-icons-preview">';
    filterIconsExpandedHTML = '<div class="filter-icons-expanded">';
    filterIcons.forEach(icon => {
      const content = icon.isHTML ? icon.url : icon.url;
      filterIconsPreviewHTML += `
        <div class="filter-icon-preview" data-filter-type="${icon.type}" style="padding: 0;">
          ${content}
        </div>`;
      filterIconsExpandedHTML += `
        <div class="filter-icon-expanded" data-filter-type="${icon.type}" style="padding: 0;">
          ${content}
        </div>`;
    });
    filterIconsPreviewHTML += '</div>';
    filterIconsExpandedHTML += '</div>';
  }

  const isDefaultImage = product.image === DEFAULT_IMAGE;
  let imageHTML = '';
  if (isDefaultImage) {
    imageHTML = `
      <div class="no-photo-container">
        <div class="no-photo-text">\u0444\u043e\u0442\u043e \u043d\u0435\u0442</div>
        <div class="product-name-scroll">${product.name}</div>
      </div>`;
  } else {
    imageHTML = `<img class="product-image-preview" src="${product.image}" alt="${product.name}" onerror="this.src='${DEFAULT_IMAGE}'">`;
  }

  let expandedHTML = '';
  if (expandedTags[product.tag]) {
    expandedHTML = `
      <div class="product-expanded">
        <div class="product-name-expanded">${highlightedName}</div>
        <div class="expanded-image-container">
          ${filterIconsExpandedHTML}
          <img class="expanded-image" src="${product.image}" alt="${product.name}" onerror="this.src='${DEFAULT_IMAGE}'">
        </div>
        <div class="product-text-expanded">${formatProductInfo(product)}</div>
        <div class="expanded-controls">
          ${quantity > 0 ? '<div class="product-comment-display" style="' + ((cart[product.id] || {}).comment ? '' : 'display:none') + '">' + ((cart[product.id] || {}).comment || '') + '</div>' : ''}
          <textarea class="product-comment-input" data-pid="${product.id}" placeholder="\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 \u043a \u0442\u043e\u0432\u0430\u0440\u0443..." style="display:none">${(cart[product.id] || {}).comment || ''}</textarea>
          <div class="expanded-buttons-row">
            <div class="quantity-controls-expanded">
              <button class="quantity-btn-expanded minus-btn ${quantity > 0 ? 'active' : ''}">
                ${BUTTON_IMAGES.minus}
              </button>
              <div class="quantity-display-expanded">${quantity > 0 ? quantity + ' ' + product.unit : '0'}</div>
              <button class="quantity-btn-expanded plus-btn ${quantity > 0 ? 'active' : ''}">
                ${BUTTON_IMAGES.plus}
              </button>
              ${quantity > 0 ? '<button class="comment-btn-expanded" data-pid="' + product.id + '" title="\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439">' + ((cart[product.id] || {}).comment ? BUTTON_IMAGES.commentFilled : BUTTON_IMAGES.commentEmpty) + '</button>' : ''}
            </div>
            ${quantity > 0 ? '<button class="delete-btn-expanded">' + BUTTON_IMAGES.delete + '</button>' : ''}
          </div>
        </div>
      </div>`;
  }

  const discount = parseFloat(product.text);
  let pricePreviewHTML;
  if (discount > 0) {
    const oldPrice = Math.round(parseFloat(product.price || 0) / (1 - discount));
    pricePreviewHTML = `<s class="old-price">${oldPrice}</s> <span class="promo-price-preview">${formatPrice(product.price)}</span>`;
  } else {
    pricePreviewHTML = formatPrice(product.price);
  }
  // Adaptive font size based on text length — CSS class approach (media-query friendly)
  const _priceTextLen = pricePreviewHTML.replace(/<[^>]+>/g, '').trim().length;
  const _priceSizeClass = _priceTextLen <= 8 ? 'price-s' : _priceTextLen <= 14 ? 'price-m' : 'price-l';

  card.innerHTML = `
    <div class="product-preview">
      ${filterIconsPreviewHTML}
      <div class="product-image-preview">
        ${imageHTML}
        <div class="quantity-badge ${quantity > 0 ? 'active' : ''}">${quantity}</div>
      </div>
      <div class="add-to-cart-btn">+</div>
      ${quantity > 0 && (cart[product.id] || {}).comment ? '<div class="comment-indicator" title="' + (cart[product.id] || {}).comment + '">\ud83d\udd8a\ufe0f</div>' : ''}
      <div class="remove-from-cart-btn ${quantity > 0 ? 'active' : ''}">-</div>
      <div class="product-price-preview ${_priceSizeClass}">${pricePreviewHTML}</div>
    </div>
    ${expandedHTML}
  `;

  card.setAttribute('data-product-id', product.id);
  card.setAttribute('data-brand', product.brand || '\u0411\u0435\u0437 \u0431\u0440\u0435\u043d\u0434\u0430');
  card.setAttribute('data-tag', product.tag);

  // Card update callback for cart operations
  const onCardUpdate = (productId, prod) => {
    const cards = document.querySelectorAll(`.product-card[data-product-id="${productId}"]`);
    cards.forEach(c => {
      const newCard = createProductCard(prod);
      if (expandedTags[prod.tag]) newCard.classList.add('expanded');
      c.replaceWith(newCard);
    });
  };

  // Event listeners
  const imagePreview = card.querySelector('.product-image-preview');
  if (!isDefaultImage) {
    const imgElement = imagePreview.querySelector('img');
    if (imgElement) imgElement.addEventListener('click', () => openImageModal(product));
  } else {
    imagePreview.addEventListener('click', () => openImageModal(product));
  }

  card.querySelector('.add-to-cart-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    updateCart(product.id, product.multiple, { onCardUpdate });
  });

  card.querySelector('.remove-from-cart-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    updateCart(product.id, -product.multiple, { onCardUpdate });
  });

  if (expandedTags[product.tag]) {
    const expandedImage = card.querySelector('.expanded-image');
    if (expandedImage) expandedImage.addEventListener('click', () => openImageModal(product));

    const minusBtn = card.querySelector('.minus-btn');
    if (minusBtn) {
      minusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        updateCart(product.id, -product.multiple, { onCardUpdate });
      });
    }

    const plusBtn = card.querySelector('.plus-btn');
    if (plusBtn) {
      plusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        updateCart(product.id, product.multiple, { onCardUpdate });
      });
    }

    const deleteBtn = card.querySelector('.delete-btn-expanded');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeProductFromCart(product.id, { onCardUpdate });
      });
    }

    // Comment button toggle
    const commentBtn = card.querySelector('.comment-btn-expanded');
    const commentInput = card.querySelector('.product-comment-input');
    const commentDisplay = card.querySelector('.product-comment-display');
    if (commentBtn && commentInput) {
      const _confirmComment = () => {
        const val = commentInput.value;
        commentInput.style.display = 'none';
        if (commentDisplay) {
          commentDisplay.textContent = val;
          commentDisplay.style.display = val ? 'block' : 'none';
        }
        commentBtn.innerHTML = val ? BUTTON_IMAGES.commentFilled : BUTTON_IMAGES.commentEmpty;
      };
      commentBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const visible = commentInput.style.display !== 'none';
        if (!visible) {
          commentInput.style.display = 'block';
          commentInput.focus();
          commentBtn.innerHTML = '✓';
        } else {
          _confirmComment();
        }
      });
      commentInput.addEventListener('click', (e) => e.stopPropagation());
      commentInput.addEventListener('input', (e) => {
        e.stopPropagation();
        const val = e.target.value;
        const currentCart = getCart();
        if (currentCart[product.id]) {
          currentCart[product.id].comment = val;
          saveCartToLocalStorage();
          scheduleDraftSave();
        }
      });
      commentInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          _confirmComment();
        }
      });
    }
  }

  return card;
}

// ── Image Modal ────────────────────────────────────────────
export function openImageModal(product) {
  const modal = document.querySelector('.image-modal');
  if (!modal) return;
  const modalImage = modal.querySelector('.modal-image');
  const modalInfo = modal.querySelector('.modal-info');
  const modalProductName = modal.querySelector('.modal-product-name');
  const modalFilterIcons = modal.querySelector('.modal-filter-icons');

  modalImage.src = product.image || DEFAULT_IMAGE;
  modalImage.onerror = function () { this.src = DEFAULT_IMAGE; };

  modalProductName.textContent = product.name;
  modalInfo.innerHTML = `
    <div style="margin-bottom: 8px;">
      <div style="color: #888; font-size: 11px; margin-bottom: 4px; text-transform: uppercase; font-weight: 500;">
        ${product.brand || '\u0411\u0435\u0437 \u0431\u0440\u0435\u043d\u0434\u0430'}
      </div>
      <div style="color: #666; font-size: 12px; line-height: 1.4; margin-bottom: 6px;">${formatProductInfo(product)}</div>
      ${product.info ? `<div style="color: #666; font-size: 12px; line-height: 1.4;">${product.info}</div>` : ''}
    </div>
  `;

  const filterIcons = getFilterIcons(product, FILTER_IMAGES);
  modalFilterIcons.innerHTML = '';
  if (filterIcons.length > 0) {
    filterIcons.forEach(icon => {
      const iconElement = document.createElement('div');
      iconElement.className = 'modal-filter-icon';
      iconElement.style.padding = '0';
      iconElement.innerHTML = icon.url;
      modalFilterIcons.appendChild(iconElement);
    });
  }

  modal.classList.add('active');
}

// ── Brands List ────────────────────────────────────────────
function createBrandsList(tagProducts, tag) {
  const brands = {};
  tagProducts.forEach(product => {
    const brand = product.brand || 'Без бренда';
    if (!brands[brand]) brands[brand] = 0;
    brands[brand]++;
  });

  const uniqueBrands = Object.keys(brands).sort();
  let brandsHTML = '<div class="brands-scroll-container"><div class="brands-list">';
  uniqueBrands.forEach(brand => {
    const count = brands[brand];
    brandsHTML += `<div class="brand-item" data-brand="${brand}" data-tag="${tag}">${brand} <span class="brand-counter">(${count})</span></div>`;
  });
  brandsHTML += '</div></div>';
  return brandsHTML;
}

// ── Scroll to Brand ────────────────────────────────────────
export function scrollToBrand(brand, tag) {
  console.log(`Прокрутка к бренду: ${brand}, тег: ${tag}`);

  const tagSections = document.querySelectorAll('.tag-section');

  tagSections.forEach(tagSection => {
    const tagTitle = tagSection.querySelector('.tag-title');
    if (!tagTitle || tagTitle.textContent.trim() !== (tag || '').trim()) return;

    const productsContainer = tagSection.querySelector('.products-scroll-container');
    const productsList = tagSection.querySelector('.products-list');

    if (!productsContainer || !productsList) return;

    const brandCards = productsList.querySelectorAll(`.product-card[data-brand="${brand}"][data-tag="${tag}"]`);

    let targetCards = brandCards;
    if (brandCards.length === 0) {
      targetCards = productsList.querySelectorAll(`.product-card[data-brand="${brand}"]`);
      if (targetCards.length === 0) return;
    }

    productsList.querySelectorAll('.product-card.highlighted').forEach(card => {
      card.classList.remove('highlighted');
    });

    targetCards.forEach(card => {
      card.classList.add('highlighted');
    });

    const firstCard = targetCards[0];
    const scrollLeft = firstCard.offsetLeft - productsContainer.offsetLeft - 20;

    productsContainer.scrollTo({
      left: scrollLeft,
      behavior: 'smooth'
    });

    setTimeout(() => {
      targetCards.forEach(card => {
        card.classList.remove('highlighted');
      });
    }, 2000);

    // Прокрутка ленты брендов
    const brandItem = tagSection.querySelector(`.brand-item[data-brand="${brand}"]`);
    if (brandItem) {
      brandItem.classList.add('clicked');
      setTimeout(() => {
        brandItem.classList.remove('clicked');
      }, 600);

      const brandsContainer = tagSection.querySelector('.brands-scroll-container');
      if (brandsContainer) {
        const brandScrollLeft = brandItem.offsetLeft - brandsContainer.offsetLeft - 20;
        brandsContainer.scrollLeft = brandScrollLeft;
      }
    }
  });
}

// ── Filtered Brands ────────────────────────────────────────
export function getFilteredBrands() {
  const products = getProducts();
  let filteredProducts = products;

  if (selectedGroup) {
    filteredProducts = filteredProducts.filter(p => p.group === selectedGroup);
  }

  if (currentFilters.length > 0) {
    filteredProducts = filteredProducts.filter(p => {
      const dopValue = p.dop || '';
      const nameValue = p.name || '';
      let passes = false;
      if (currentFilters.includes('promo') && (dopValue.includes('акция!!!') || dopValue.includes('распродажа!!!'))) passes = true;
      if (currentFilters.includes('new') && nameValue.includes('🆕')) passes = true;
      if (currentFilters.includes('arrival') && dopValue.includes('поступление')) passes = true;
      if (currentFilters.includes('actual') && dopValue.includes('актуально')) passes = true;
      if (currentFilters.includes('child') && dopValue.toLowerCase().includes('детское')) passes = true;
      if (currentFilters.includes('discount') && dopValue.toLowerCase().includes('уценка')) passes = true;
      return passes;
    });
  }

  if (searchQuery) {
    filteredProducts = filteredProducts.filter(p => {
      const nameValue = p.name || '';
      const brandValue = p.brand || '';
      return nameValue.toLowerCase().includes(searchQuery.toLowerCase()) ||
             brandValue.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }

  const brands = {};
  filteredProducts.forEach(product => {
    const brand = product.brand || 'Без бренда';
    if (!brands[brand]) {
      brands[brand] = {
        count: 0,
        hasPromo: false,
        hasNew: false,
        hasArrival: false,
        hasActual: false,
        hasChild: false,
        hasDiscount: false
      };
    }
    brands[brand].count++;

    const dopValue = product.dop || '';
    const nameValue = product.name || '';

    if (dopValue.includes('акция!!!') || dopValue.includes('распродажа!!!')) brands[brand].hasPromo = true;
    if (nameValue.includes('🆕')) brands[brand].hasNew = true;
    if (dopValue.includes('поступление')) brands[brand].hasArrival = true;
    if (dopValue.includes('актуально')) brands[brand].hasActual = true;
    if (dopValue.toLowerCase().includes('детское')) brands[brand].hasChild = true;
    if (dopValue.toLowerCase().includes('уценка')) brands[brand].hasDiscount = true;
  });

  return brands;
}

// ── Update Brands Filter Panel ─────────────────────────────
export function updateBrandsFilterPanel() {
  const brands = getFilteredBrands();
  const uniqueBrands = Object.keys(brands).sort();
  const mainBrandsFilter = document.getElementById('main-brands-filter');
  if (!mainBrandsFilter) return;
  mainBrandsFilter.innerHTML = '';

  const allBrandsBtn = document.createElement('div');
  allBrandsBtn.className = `brand-filter-btn clear-all ${selectedBrands.length === 0 ? 'active' : ''}`;
  allBrandsBtn.textContent = 'Все бренды';
  allBrandsBtn.setAttribute('data-tip-below', 'Сбросить фильтр — показать все бренды');
  allBrandsBtn.dataset.brand = 'all';
  mainBrandsFilter.appendChild(allBrandsBtn);

  uniqueBrands.forEach(brand => {
    const brandBtn = document.createElement('div');
    brandBtn.className = `brand-filter-btn ${selectedBrands.includes(brand) ? 'active' : ''}`;
    if (brands[brand].count === 0) {
      brandBtn.classList.add('disabled');
    }
    brandBtn.textContent = brand;
    brandBtn.dataset.brand = brand;
    brandBtn.setAttribute('data-tip-below', 'Фильтр по бренду — покажет только товары этого производителя');
    mainBrandsFilter.appendChild(brandBtn);
  });
}

// ── Groups Filter ──────────────────────────────────────────
export function createGroupsFilter() {
  const products = getProducts();
  const allGroups = [...new Set(products.map(p => p.group).filter(g => g))].sort();

  const groupsFilter = document.getElementById('groups-filter');
  if (!groupsFilter) return;
  groupsFilter.innerHTML = '';

  allGroups.forEach(group => {
    const groupBtn = document.createElement('div');
    groupBtn.className = `group-filter-btn ${selectedGroup === group ? 'active' : ''}`;
    groupBtn.textContent = group;
    groupBtn.dataset.group = group;
    groupBtn.setAttribute('data-tip-below', 'Группа товаров — нажмите для выбора категории');
    groupsFilter.appendChild(groupBtn);
  });

  if (!selectedGroup && allGroups.length > 0) {
    selectedGroup = allGroups[0];
    const firstBtn = groupsFilter.querySelector('.group-filter-btn');
    if (firstBtn) firstBtn.classList.add('active');
  }

  createSubgroupsFilter();
  setTimeout(() => scrollActiveGroupIntoView(), 100);
}

// ── Subgroups Filter ───────────────────────────────────────
export function createSubgroupsFilter() {
  const subgroupsContainer = document.getElementById('subgroups-filter');
  if (!subgroupsContainer) return;
  subgroupsContainer.innerHTML = '';
  if (!selectedGroup) return;

  const products = getProducts();
  const groupProducts = products.filter(p => p.group === selectedGroup);
  const subgroups = Array.from(new Set(groupProducts.map(p => p.subgroup || 'Без подгруппы')))
    .sort((a, b) => String(a).localeCompare(String(b), 'ru', { sensitivity: 'base' }));

  if (subgroups.length === 0) return;

  subgroups.forEach(subgroup => {
    const subgroupBtn = document.createElement('div');
    subgroupBtn.className = 'subgroup-filter-btn';
    subgroupBtn.textContent = subgroup;
    subgroupBtn.dataset.subgroup = subgroup;
    subgroupBtn.setAttribute('data-tip-below', 'Подгруппа — фильтр внутри категории');
    subgroupsContainer.appendChild(subgroupBtn);
  });

  setTimeout(() => centerActiveSubgroup(), 80);
}

function centerActiveSubgroup() {
  const container = document.getElementById('subgroups-filter');
  if (!container) return;
  const target = container.querySelector('.subgroup-filter-btn.active') || container.querySelector('.subgroup-filter-btn');
  if (!target) return;
  try {
    target.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  } catch (err) {
    const rect = target.getBoundingClientRect();
    const contRect = container.getBoundingClientRect();
    const offset = (rect.left + rect.width / 2) - (contRect.left + contRect.width / 2);
    container.scrollBy({ left: offset, behavior: 'smooth' });
  }
}

// ── Toggle Group ───────────────────────────────────────────
export function toggleGroupFilter(group) {
  selectedGroup = group;
  createGroupsFilter();
  updateBrandsFilterPanel();
  updateFilterButtons();
  updateFilterCounts();
  renderProducts();
  setTimeout(() => scrollActiveGroupIntoView(), 100);
}

// ── Toggle Brand ───────────────────────────────────────────
export function toggleBrandFilter(brand) {
  if (brand === 'all') {
    selectedBrands = [];
  } else {
    const index = selectedBrands.indexOf(brand);
    if (index >= 0) {
      selectedBrands.splice(index, 1);
    } else {
      selectedBrands.push(brand);
    }
  }
  updateBrandsFilterPanel();
  updateFilterButtons();
  updateFilterCounts();
  renderProducts();
}

// ── Check Filter Availability ──────────────────────────────
export function checkFilterAvailability(filter) {
  const products = getProducts();
  let filteredProducts = products;

  if (selectedGroup) {
    filteredProducts = filteredProducts.filter(p => p.group === selectedGroup);
  }

  if (selectedBrands.length > 0) {
    filteredProducts = filteredProducts.filter(p =>
      selectedBrands.includes(p.brand || 'Без бренда')
    );
  }

  if (searchQuery) {
    filteredProducts = filteredProducts.filter(p => {
      const nameValue = p.name || '';
      const brandValue = p.brand || '';
      return nameValue.toLowerCase().includes(searchQuery.toLowerCase()) ||
             brandValue.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }

  switch (filter) {
    case 'promo':
      return filteredProducts.some(p => {
        const dopValue = p.dop || '';
        return dopValue.includes('акция!!!') || dopValue.includes('распродажа!!!');
      });
    case 'new':
      return filteredProducts.some(p => (p.name || '').includes('🆕'));
    case 'arrival':
      return filteredProducts.some(p => (p.dop || '').includes('поступление'));
    case 'actual':
      return filteredProducts.some(p => (p.dop || '').includes('актуально'));
    case 'child':
      return filteredProducts.some(p => (p.dop || '').toLowerCase().includes('детское'));
    case 'discount':
      return filteredProducts.some(p => (p.dop || '').toLowerCase().includes('уценка'));
    default:
      return true;
  }
}

// ── Reset Filters ──────────────────────────────────────────
export function resetFilters() {
  currentFilters = [];
  updateFilterButtons();
  updateBrandsFilterPanel();
  updateFilterCounts();
  renderProducts();
}

// ── Update Filter Buttons ──────────────────────────────────
export function updateFilterButtons() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    const filter = btn.dataset.filter;
    const isActive = currentFilters.includes(filter);
    const isAvailable = checkFilterAvailability(filter);
    btn.classList.toggle('active', isActive);
    if (!isAvailable && !isActive) {
      btn.classList.add('disabled');
    } else {
      btn.classList.remove('disabled');
    }
  });
  // Show/hide reset button
  const resetContainer = document.getElementById('filter-reset-container');
  if (resetContainer) {
    resetContainer.classList.toggle('active', currentFilters.length > 0);
  }
  updateGroupDimming();
}

// ── Toggle Simple Filter ───────────────────────────────────
export function toggleSimpleFilter(filter) {
  const idx = currentFilters.indexOf(filter);
  if (idx > -1) {
    currentFilters.splice(idx, 1);
  } else {
    currentFilters.push(filter);
  }
  updateFilterButtons();
  updateBrandsFilterPanel();
  updateFilterCounts();
  renderProducts();
}

// ── Update Filter Counts ───────────────────────────────────
export function updateFilterCounts() {
  const products = getProducts();
  const filters = ['promo', 'new', 'arrival', 'actual', 'child', 'discount'];

  filters.forEach(filter => {
    let count = 0;
    let filteredProducts = products;

    if (selectedGroup) {
      filteredProducts = filteredProducts.filter(p => p.group === selectedGroup);
    }
    if (searchQuery) {
      filteredProducts = filteredProducts.filter(p => {
        const nameValue = p.name || '';
        const brandValue = p.brand || '';
        return nameValue.toLowerCase().includes(searchQuery.toLowerCase()) ||
               brandValue.toLowerCase().includes(searchQuery.toLowerCase());
      });
    }

    filteredProducts.forEach(p => {
      const dopValue = p.dop || '';
      const nameValue = p.name || '';
      switch (filter) {
        case 'promo': if (dopValue.includes('\u0430\u043a\u0446\u0438\u044f!!!') || dopValue.includes('\u0440\u0430\u0441\u043f\u0440\u043e\u0434\u0430\u0436\u0430!!!')) count++; break;
        case 'new': if (nameValue.includes('\ud83c\udd95')) count++; break;
        case 'arrival': if (dopValue.includes('\u043f\u043e\u0441\u0442\u0443\u043f\u043b\u0435\u043d\u0438\u0435')) count++; break;
        case 'actual': if (dopValue.includes('\u0430\u043a\u0442\u0443\u0430\u043b\u044c\u043d\u043e')) count++; break;
        case 'child': if (dopValue.toLowerCase().includes('\u0434\u0435\u0442\u0441\u043a\u043e\u0435')) count++; break;
        case 'discount': if (dopValue.toLowerCase().includes('\u0443\u0446\u0435\u043d\u043a\u0430')) count++; break;
      }
    });

    const countEl = document.querySelector(`.filter-count[data-filter="${filter}"]`);
    if (countEl) countEl.textContent = count;
  });
}

// ── Scroll Helpers ─────────────────────────────────────────
function scrollActiveGroupIntoView() {
  const groupsFilter = document.getElementById('groups-filter');
  if (!groupsFilter) return;
  const activeGroupBtn = groupsFilter.querySelector('.group-filter-btn.active');
  if (!activeGroupBtn) return;
  const container = groupsFilter.parentElement;
  const containerWidth = container.clientWidth;
  const scrollLeft = container.scrollLeft;
  const btnLeft = activeGroupBtn.offsetLeft;
  const btnWidth = activeGroupBtn.offsetWidth;
  if (btnLeft < scrollLeft || btnLeft + btnWidth > scrollLeft + containerWidth) {
    container.scrollTo({ left: btnLeft - containerWidth / 2 + btnWidth / 2, behavior: 'smooth' });
  }
}

export function scrollToSubgroup(subgroup) {
  const subgroupHeaders = document.querySelectorAll('.subgroup-header');
  let targetHeader = null;
  subgroupHeaders.forEach(header => {
    if (header.textContent.trim() === subgroup.trim()) targetHeader = header;
  });
  if (targetHeader) {
    targetHeader.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetHeader.classList.add('highlighted');
    setTimeout(() => targetHeader.classList.remove('highlighted'), 2000);
  }
}

// ── Subgroup Visibility Observer ───────────────────────────
export function initSubgroupVisibilityObserver() {
  if (_subgroupScrollListener) {
    window.removeEventListener('scroll', _subgroupScrollListener);
    _subgroupScrollListener = null;
  }

  function findNextSubgroupHeader(header) {
    const all = document.querySelectorAll('.subgroup-header[data-subgroup]');
    let found = false;
    for (const h of all) {
      if (found) return h;
      if (h === header) found = true;
    }
    return null;
  }

  function updateInViewButtons() {
    const headers = document.querySelectorAll('.subgroup-header[data-subgroup]');
    if (!headers.length) return;

    const viewTop = 0;
    const viewBottom = window.innerHeight;
    const sectionFill = new Map();
    const catalogBottom = (document.querySelector('.products-container') || document.body)
      .getBoundingClientRect().bottom;

    headers.forEach(header => {
      const rect = header.getBoundingClientRect();
      const nextHeader = findNextSubgroupHeader(header);
      const sectionBottom = nextHeader ? nextHeader.getBoundingClientRect().top : catalogBottom;
      const sectionHeight = sectionBottom - rect.top;
      if (sectionHeight <= 0) return;

      const overlapTop = Math.max(rect.top, viewTop);
      const overlapBottom = Math.min(sectionBottom, viewBottom);
      const overlap = Math.max(0, overlapBottom - overlapTop);
      const fill = overlap / sectionHeight;
      const visStart = Math.max(0, (viewTop - rect.top) / sectionHeight);
      const visEnd = Math.min(1, (viewBottom - rect.top) / sectionHeight);

      if (overlap > 0) {
        sectionFill.set(header.dataset.subgroup, { fill, visStart, visEnd });
      }
    });

    const blur = 12;
    document.querySelectorAll('.subgroup-filter-btn[data-subgroup]').forEach(btn => {
      const name = btn.dataset.subgroup;
      if (sectionFill.has(name)) {
        btn.classList.add('in-view');
        const { fill, visStart, visEnd } = sectionFill.get(name);
        const pStart = Math.round(visStart * 100);
        const pEnd = Math.round(visEnd * 100);
        const ps0 = Math.max(0, pStart - blur);
        const ps1 = Math.min(100, pStart + blur);
        const pe0 = Math.max(0, pEnd - blur);
        const pe1 = Math.min(100, pEnd + blur);

        const stops = [];
        const base = 'rgba(211,47,47,0.10)';
        if (ps0 > 0) stops.push(`${base} 0%`);
        if (ps0 > 0) stops.push(`${base} ${ps0}%`);
        stops.push(`#d32f2f ${ps1}%`);
        stops.push(`#d32f2f ${pe0}%`);
        if (pe1 < 100) stops.push(`${base} ${pe1}%`);
        if (pe1 < 100) stops.push(`${base} 100%`);

        btn.style.background = `linear-gradient(to right, ${stops.join(', ')})`;
        btn.style.borderColor = `rgba(211,47,47,${0.25 + fill * 0.75})`;
        btn.style.color = fill >= 0.35 ? '#fff' : 'rgba(211,47,47,0.75)';
      } else {
        btn.classList.remove('in-view');
        btn.style.background = '';
        btn.style.borderColor = '';
        btn.style.color = '';
      }
    });

    const filterScroll = document.getElementById('subgroups-filter');
    if (filterScroll && sectionFill.size > 0) {
      const firstName = [...sectionFill.keys()][0];
      const firstBtn = filterScroll.querySelector(
        `.subgroup-filter-btn[data-subgroup="${CSS.escape(firstName)}"]`
      );
      if (firstBtn) {
        const btnRect = firstBtn.getBoundingClientRect();
        const scrollRect = filterScroll.getBoundingClientRect();
        if (btnRect.left < scrollRect.left || btnRect.right > scrollRect.right) {
          firstBtn.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
        }
      }
    }
  }

  let _rafPending = false;
  _subgroupScrollListener = () => {
    if (_rafPending) return;
    _rafPending = true;
    requestAnimationFrame(() => {
      updateInViewButtons();
      _rafPending = false;
    });
  };

  window.addEventListener('scroll', _subgroupScrollListener, { passive: true });
  updateInViewButtons();
}

// ── Enable Wheel for Horizontal Lanes ──────────────────────
export function enableWheelForAllLanes() {
  const selectors = [
    '.products-scroll-container', '.products-list',
    '.groups-filter-section', '.groups-filter-scroll',
    '.subgroups-filter-scroll', '.brands-scroll-container',
    '.brands-filter-scroll',
  ];
  document.querySelectorAll(selectors.join(',')).forEach(container => {
    if (!container || container.__wheelBound) return;
    container.__wheelBound = true;
    container.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (container.scrollWidth <= container.clientWidth) return;
      container.scrollLeft += e.deltaY;
      e.preventDefault();
    }, { passive: false });
  });
}

// ── Main Render ────────────────────────────────────────────
export function renderProducts() {
  const products = getProducts();
  const productsContainer = document.querySelector('.products-container');
  if (!productsContainer) return;
  productsContainer.innerHTML = '';

  let filteredProducts = products;

  if (selectedGroup) {
    filteredProducts = filteredProducts.filter(p => p.group === selectedGroup);
  }

  if (currentFilters.length > 0) {
    filteredProducts = filteredProducts.filter(p => {
      let passesFilter = false;
      const dopValue = p.dop || '';
      const nameValue = p.name || '';
      if (currentFilters.includes('promo') && (dopValue.includes('\u0430\u043a\u0446\u0438\u044f!!!') || dopValue.includes('\u0440\u0430\u0441\u043f\u0440\u043e\u0434\u0430\u0436\u0430!!!'))) passesFilter = true;
      if (currentFilters.includes('new') && nameValue.includes('\ud83c\udd95')) passesFilter = true;
      if (currentFilters.includes('arrival') && dopValue.includes('\u043f\u043e\u0441\u0442\u0443\u043f\u043b\u0435\u043d\u0438\u0435')) passesFilter = true;
      if (currentFilters.includes('actual') && dopValue.includes('\u0430\u043a\u0442\u0443\u0430\u043b\u044c\u043d\u043e')) passesFilter = true;
      if (currentFilters.includes('child') && dopValue.toLowerCase().includes('\u0434\u0435\u0442\u0441\u043a\u043e\u0435')) passesFilter = true;
      if (currentFilters.includes('discount') && dopValue.toLowerCase().includes('\u0443\u0446\u0435\u043d\u043a\u0430')) passesFilter = true;
      return passesFilter;
    });
  }

  if (selectedBrands.length > 0) {
    filteredProducts = filteredProducts.filter(p =>
      selectedBrands.includes(p.brand || '\u0411\u0435\u0437 \u0431\u0440\u0435\u043d\u0434\u0430')
    );
  }

  if (searchQuery) {
    filteredProducts = filteredProducts.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }

  filteredProducts.sort((a, b) => {
    if (a.brand < b.brand) return -1;
    if (a.brand > b.brand) return 1;
    return parseFloat(a.price) - parseFloat(b.price);
  });

  // Empty state: filters active but no products match in this group
  if (filteredProducts.length === 0 && hasActiveFiltering()) {
    const RESET_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="#464743" viewBox="0 0 256 256"><path d="M227.73,66.85,160,139.17v55.49A16,16,0,0,1,152.87,208l-32,21.34A16,16,0,0,1,96,216V139.17L28.27,66.85l-.08-.09A16,16,0,0,1,40,40H216a16,16,0,0,1,11.84,26.76ZM227.31,192l18.35-18.34a8,8,0,0,0-11.32-11.32L216,180.69l-18.34-18.35a8,8,0,0,0-11.32,11.32L204.69,192l-18.35,18.34a8,8,0,0,0,11.32,11.32L216,203.31l18.34,18.35a8,8,0,0,0,11.32-11.32Z"></path></svg>';
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-filter-message';
    emptyDiv.innerHTML = `
      <div class="empty-filter-message__text">
        В данной товарной группе товары с выбранной фильтрацией отсутствуют
      </div>
      <div class="empty-filter-message__hint">
        Чтобы увидеть — нажмите кнопку «Сброс»
        <button class="empty-filter-reset-btn" title="\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u0444\u0438\u043b\u044c\u0442\u0440\u044b">${RESET_SVG}</button>
      </div>
    `;
    productsContainer.appendChild(emptyDiv);
    return;
  }

  const groups = [...new Set(filteredProducts.map(p => p.group))];

  groups.forEach(group => {
    const groupProducts = filteredProducts.filter(p => p.group === group);
    const groupSection = document.createElement('div');
    groupSection.className = 'group-section';

    const groupHeader = document.createElement('div');
    groupHeader.className = 'group-header';
    groupHeader.textContent = group;
    groupSection.appendChild(groupHeader);

    const subgroups = Array.from(new Set(groupProducts.map(p => p.subgroup || '\u0411\u0435\u0437 \u043f\u043e\u0434\u0433\u0440\u0443\u043f\u043f\u044b')))
      .sort((a, b) => String(a).localeCompare(String(b), 'ru', { sensitivity: 'base' }));

    subgroups.forEach(subgroup => {
      const subgroupProducts = groupProducts.filter(p => p.subgroup === subgroup);
      const subgroupHeader = document.createElement('div');
      subgroupHeader.className = 'subgroup-header';
      subgroupHeader.textContent = subgroup;
      subgroupHeader.dataset.subgroup = subgroup;
      groupSection.appendChild(subgroupHeader);

      const tags = Array.from(new Set(subgroupProducts.map(p => p.tag || '\u0411\u0435\u0437 \u0442\u0435\u0433\u0430')))
        .sort((a, b) => String(a).localeCompare(String(b), 'ru', { sensitivity: 'base' }));

      tags.forEach(tag => {
        // Default sort: price on first encounter
        if (tagSortMode[tag] === undefined) tagSortMode[tag] = 'price';

        let tagProducts = subgroupProducts.filter(p => p.tag === tag);
        const sortMode = tagSortMode[tag];

        if (sortMode === 'price') {
          tagProducts = [...tagProducts].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
        } else if (sortMode === 'brand') {
          tagProducts = [...tagProducts].sort((a, b) => {
            const brandA = (a.brand || '\u0411\u0435\u0437 \u0431\u0440\u0435\u043d\u0434\u0430').toLowerCase();
            const brandB = (b.brand || '\u0411\u0435\u0437 \u0431\u0440\u0435\u043d\u0434\u0430').toLowerCase();
            if (brandA < brandB) return -1;
            if (brandA > brandB) return 1;
            return 0;
          });
        }

        const tagSection = document.createElement('div');
        tagSection.className = 'tag-section';

        const tagHeader = document.createElement('div');
        tagHeader.className = 'tag-header';
        const tagTitle = document.createElement('div');
        tagTitle.className = 'tag-title';
        tagTitle.textContent = tag;

        const currentSort = tagSortMode[tag];

        const sortInline = document.createElement('div');
        sortInline.className = 'tag-sort-inline';

        const priceLabel = document.createElement('button');
        priceLabel.className = 'sort-label-btn sort-price-btn' + (currentSort === 'price' ? ' active' : '');
        priceLabel.type = 'button';
        priceLabel.textContent = '\u043f\u043e \u0446\u0435\u043d\u0435';
        priceLabel.dataset.tag = tag;
        priceLabel.dataset.sort = 'price';

        const iconBtn = document.createElement('button');
        iconBtn.className = 'sort-icon-btn';
        iconBtn.type = 'button';
        iconBtn.dataset.tag = tag;
        iconBtn.innerHTML = currentSort === 'brand' ? SORT_SVG_BRAND : SORT_SVG_PRICE;

        const brandLabel = document.createElement('button');
        brandLabel.className = 'sort-label-btn sort-brand-btn' + (currentSort === 'brand' ? ' active' : '');
        brandLabel.type = 'button';
        brandLabel.textContent = '\u043f\u043e \u0431\u0440\u0435\u043d\u0434\u0443';
        brandLabel.dataset.tag = tag;
        brandLabel.dataset.sort = 'brand';

        sortInline.appendChild(priceLabel);
        sortInline.appendChild(iconBtn);
        sortInline.appendChild(brandLabel);

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'toggle-tag-btn';
        toggleBtn.textContent = expandedTags[tag] ? '\u0441\u0432\u0435\u0440\u043d\u0443\u0442\u044c' : '\u0440\u0430\u0437\u0432\u0435\u0440\u043d\u0443\u0442\u044c';
        toggleBtn.setAttribute('data-tip', expandedTags[tag] ? '\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u2014 \u043e\u0434\u043d\u0430 \u0441\u0442\u0440\u043e\u043a\u0430 \u043d\u0430 \u0442\u043e\u0432\u0430\u0440' : '\u0420\u0430\u0437\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u2014 \u043f\u043e\u043b\u043d\u0430\u044f \u0438\u043d\u0444\u043e \u0438 \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u0432 \u0437\u0430\u043a\u0430\u0437');
        toggleBtn.dataset.tag = tag;

        tagHeader.appendChild(tagTitle);
        tagHeader.appendChild(sortInline);
        tagHeader.appendChild(toggleBtn);

        const brandsHTML = createBrandsList(tagProducts, tag);

        const productsScrollContainer = document.createElement('div');
        productsScrollContainer.className = 'products-scroll-container';
        const productsList = document.createElement('div');
        productsList.className = 'products-list';

        tagProducts.forEach(product => {
          const productCard = createProductCard(product);
          productCard.setAttribute('data-product-id', product.id);
          productCard.setAttribute('data-brand', product.brand || '\u0411\u0435\u0437 \u0431\u0440\u0435\u043d\u0434\u0430');
          productCard.setAttribute('data-tag', product.tag);
          if (expandedTags[tag]) productCard.classList.add('expanded');
          productsList.appendChild(productCard);
        });

        productsScrollContainer.appendChild(productsList);
        tagSection.appendChild(tagHeader);
        if (brandsHTML) tagSection.insertAdjacentHTML('beforeend', brandsHTML);
        tagSection.appendChild(productsScrollContainer);
        groupSection.appendChild(tagSection);
      });
    });

    productsContainer.appendChild(groupSection);
  });

  // Brand dividers
  setTimeout(() => {
    document.querySelectorAll('.tag-section').forEach(section => {
      const productsList = section.querySelector('.products-list');
      if (!productsList) return;
      const cards = productsList.querySelectorAll('.product-card');
      let previousBrand = null;
      let previousCard = null;
      cards.forEach((card, index) => {
        const currentBrand = card.getAttribute('data-brand');
        if (index > 0 && previousBrand !== currentBrand && previousCard) {
          const divider = document.createElement('div');
          divider.className = 'brand-divider';
          const previousRect = previousCard.getBoundingClientRect();
          const productsListRect = productsList.getBoundingClientRect();
          const leftPosition = previousRect.right - productsListRect.left + 5;
          divider.style.left = `${leftPosition}px`;
          productsList.appendChild(divider);
        }
        previousBrand = currentBrand;
        previousCard = card;
      });
    });
  }, 100);

  setTimeout(() => scrollActiveGroupIntoView(), 150);

  try { enableWheelForAllLanes(); } catch (e) { console.warn('enableWheelForAllLanes after render failed', e); }

  initSubgroupVisibilityObserver();
}

// ── Event Delegation for Sort/Toggle ───────────────────────
export function initCatalogListeners() {
  // Обработчик групп
  document.addEventListener('click', (e) => {
    const groupBtn = e.target.closest('.group-filter-btn:not(.disabled)');
    if (groupBtn) {
      const group = groupBtn.dataset.group;
      toggleGroupFilter(group);
    }
  });

  // Обработчик брендов в нижней панели
  document.addEventListener('click', (e) => {
    const brandBtn = e.target.closest('.brand-filter-btn:not(.disabled)');
    if (brandBtn) {
      const brand = brandBtn.dataset.brand;
      toggleBrandFilter(brand);
    }
  });

  // Обработчик брендов в лентах
  document.addEventListener('click', (e) => {
    const brandItem = e.target.closest('.brand-item:not(.disabled)');
    if (brandItem) {
      const brand = brandItem.dataset.brand;
      const tag = brandItem.dataset.tag;
      scrollToBrand(brand, tag);
    }
  });

  // Обработчик сворачивания/разворачивания тегов и сортировки
  document.addEventListener('click', (e) => {
    // Кнопка свернуть/развернуть
    if (e.target.classList.contains('toggle-tag-btn')) {
      const tag = e.target.dataset.tag;
      expandedTags[tag] = !expandedTags[tag];
      e.target.textContent = expandedTags[tag] ? 'свернуть' : 'развернуть';
      renderProducts();
      return;
    }

    // Кнопки inline-сортировки (по цене / по бренду)
    const sortLabelBtn = e.target.closest('.sort-label-btn');
    if (sortLabelBtn) {
      const tag = sortLabelBtn.dataset.tag;
      const sortType = sortLabelBtn.dataset.sort;
      if (tag && sortType) {
        tagSortMode[tag] = sortType;
        renderProducts();
      }
      return;
    }

    // Иконка сортировки — переключает между режимами
    const sortIconBtn = e.target.closest('.sort-icon-btn');
    if (sortIconBtn) {
      const tag = sortIconBtn.dataset.tag;
      if (tag) {
        const cur = tagSortMode[tag];
        tagSortMode[tag] = cur === 'price' ? 'brand' : 'price';
        renderProducts();
      }
      return;
    }
  });

  // Обработчик фильтров (делегирование через document)
  document.addEventListener('click', (e) => {
    const filterBtn = e.target.closest('.filter-btn:not(.disabled)');
    if (filterBtn) {
      const filter = filterBtn.dataset.filter;
      toggleSimpleFilter(filter);
    }
  });

  // Кнопка сброса фильтров (панель + пустой экран)
  document.addEventListener('click', (e) => {
    if (e.target.closest('#filter-reset-btn') || e.target.closest('.filter-reset-btn') || e.target.closest('.empty-filter-reset-btn')) {
      resetFilters();
    }
  });

  // Обработчик подгрупп
  document.addEventListener('click', (e) => {
    const subgroupBtn = e.target.closest('.subgroup-filter-btn');
    if (subgroupBtn) {
      const subgroup = subgroupBtn.dataset.subgroup;
      scrollToSubgroup(subgroup);
    }
  });

  // Обработчик поиска
  const searchToggleBtn = document.querySelector('#search-toggle-btn');
  const searchExpandedContainer = document.querySelector('.search-expanded-container');
  const searchInputExpanded = document.querySelector('.search-input-expanded');
  const clearSearchExpanded = document.querySelector('.clear-search-expanded');

  if (searchToggleBtn && searchExpandedContainer) {
    searchToggleBtn.addEventListener('click', () => {
      searchExpandedContainer.classList.toggle('active');
      if (searchExpandedContainer.classList.contains('active')) {
        setTimeout(() => { if (searchInputExpanded) searchInputExpanded.focus(); }, 100);
      } else {
        if (searchInputExpanded) searchInputExpanded.value = '';
        searchQuery = '';
        if (clearSearchExpanded) clearSearchExpanded.classList.remove('active');
        updateBrandsFilterPanel();
        updateFilterButtons();
        updateFilterCounts();
        renderProducts();
      }
    });
  }

  if (searchInputExpanded) {
    searchInputExpanded.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      if (clearSearchExpanded) clearSearchExpanded.classList.toggle('active', searchQuery.length > 0);
      updateBrandsFilterPanel();
      updateFilterButtons();
      updateFilterCounts();
      renderProducts();
    });
  }

  if (clearSearchExpanded) {
    clearSearchExpanded.addEventListener('click', () => {
      if (searchInputExpanded) searchInputExpanded.value = '';
      searchQuery = '';
      clearSearchExpanded.classList.remove('active');
      updateBrandsFilterPanel();
      updateFilterButtons();
      updateFilterCounts();
      renderProducts();
      if (searchInputExpanded) searchInputExpanded.focus();
    });
  }

  // Глобальный поиск
  const globalSearchOpenBtn = document.querySelector('#global-search-open-btn');
  if (globalSearchOpenBtn) {
    const globalSearchModal = document.querySelector('.global-search-modal');
    const globalSearchInput = document.querySelector('.global-search-input');
    const globalSearchList = document.querySelector('.global-search-list');
    const globalSearchDetails = document.querySelector('.global-search-details');
    const globalSearchClose = document.querySelector('.global-search-close');

    function closeGlobalSearch() {
      if (!globalSearchModal) return;
      globalSearchModal.classList.remove('active');
      if (globalSearchInput) globalSearchInput.value = '';
      if (globalSearchList) globalSearchList.innerHTML = '';
      if (globalSearchDetails) globalSearchDetails.innerHTML = '';
    }

    globalSearchOpenBtn.addEventListener('click', () => {
      if (!globalSearchModal) return;
      globalSearchModal.classList.add('active');
      if (searchExpandedContainer) searchExpandedContainer.classList.remove('active');
      setTimeout(() => { if (globalSearchInput) globalSearchInput.focus(); }, 100);
    });

    if (globalSearchClose) {
      globalSearchClose.addEventListener('click', () => closeGlobalSearch());
    }

    if (globalSearchModal) {
      globalSearchModal.addEventListener('click', (e) => {
        if (e.target === globalSearchModal) closeGlobalSearch();
      });
    }

    if (globalSearchInput && globalSearchList) {
      globalSearchInput.addEventListener('input', (e) => {
        const rawQuery = e.target.value.trim();
        const query = rawQuery.toLowerCase();
        globalSearchList.innerHTML = '';
        if (globalSearchDetails) globalSearchDetails.innerHTML = '';
        if (query.length < 3) return;

        const products = getProducts();
        const results = products.filter(p => {
          const name = (p.name || '').toLowerCase();
          const brand = (p.brand || '').toLowerCase();
          const group = (p.group || '').toLowerCase();
          return name.includes(query) || brand.includes(query) || group.includes(query);
        }).slice(0, 100);

        const groupsMap = {};
        results.forEach(p => {
          const g = (p.group && p.group.trim()) ? p.group.trim() : 'Без группы';
          if (!groupsMap[g]) groupsMap[g] = [];
          groupsMap[g].push(p);
        });

        Object.keys(groupsMap).sort().forEach(groupName => {
          const groupHeader = document.createElement('div');
          groupHeader.className = 'global-search-group-header';
          groupHeader.textContent = groupName;
          groupHeader.style.cursor = 'pointer';
          groupHeader.addEventListener('click', () => {
            if (selectedGroup !== groupName) toggleGroupFilter(groupName);
            closeGlobalSearch();
          });
          globalSearchList.appendChild(groupHeader);

          groupsMap[groupName].forEach(product => {
            const item = document.createElement('div');
            item.className = 'global-search-item';
            item.dataset.productId = product.id;

            const thumb = document.createElement('div');
            thumb.className = 'global-search-thumb';
            if (product.image && product.image !== DEFAULT_IMAGE) {
              const img = document.createElement('img');
              img.src = product.image;
              img.alt = product.name;
              img.onerror = () => { img.src = DEFAULT_IMAGE; };
              thumb.appendChild(img);
            } else {
              thumb.textContent = 'нет фото';
            }

            const info = document.createElement('div');
            info.className = 'global-search-info';

            const nameEl = document.createElement('div');
            nameEl.className = 'global-search-name';
            nameEl.innerHTML = highlightText(product.name || '', rawQuery);

            const meta = document.createElement('div');
            meta.className = 'global-search-meta';
            meta.innerHTML = `<span>${formatPrice(product.price)} ₽</span><span>остаток: ${product.stock}</span><span>${highlightText(product.brand || 'Без бренда', rawQuery)}</span><span>${product.group}</span>`;

            info.appendChild(nameEl);
            info.appendChild(meta);
            item.appendChild(thumb);
            item.appendChild(info);

            item.addEventListener('click', () => {
              if (selectedGroup !== groupName) toggleGroupFilter(groupName);
              closeGlobalSearch();
              setTimeout(() => {
                const card = document.querySelector(`.product-card[data-product-id="${product.id}"]`);
                if (card) {
                  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  card.classList.add('highlighted');
                  setTimeout(() => card.classList.remove('highlighted'), 2000);
                }
              }, 300);
            });

            globalSearchList.appendChild(item);
          });
        });

        if (results.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'global-search-empty';
          empty.textContent = 'Ничего не найдено';
          globalSearchList.appendChild(empty);
        }
      });
    }
  }
}
