/**
 * Splash Screen Component
 * Loading screen with progress bar, product preview lanes, and enter button.
 */

import { FILTER_IMAGES, DEFAULT_IMAGE, enableWheelForAllLanes } from './Catalog.js';

// ── Progress bar ───────────────────────────────────────────
export function updateSplashProgress(percent, loadedCount, totalCount) {
  const bar = document.getElementById('splash-loader-bar');
  const pct = document.getElementById('splash-percent');
  const count = document.getElementById('splash-count');
  if (bar) bar.style.width = (percent || 0) + '%';
  if (pct) pct.textContent = (percent || 0) + '%';
  if (count) {
    if (totalCount) count.textContent = `Загружено ${loadedCount} из ${totalCount} товаров`;
    else count.textContent = `Загружено ${loadedCount} товаров`;
  }
}

// ── Counts animation ───────────────────────────────────────
export function updateSplashCounts(promoCount, newCount) {
  const promoEl = document.getElementById('splash-promo-count');
  const newEl = document.getElementById('splash-new-count');
  if (promoEl) animateNumberTo(promoEl, promoCount);
  if (newEl) animateNumberTo(newEl, newCount);
}

function animateNumberTo(el, target) {
  const start = parseInt(el.textContent || '0', 10) || 0;
  const duration = 600;
  const startTime = performance.now();
  function step(now) {
    const t = Math.min(1, (now - startTime) / duration);
    const value = Math.floor(start + (target - start) * t);
    el.textContent = String(value);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── Helpers ────────────────────────────────────────────────
const sortFn = (a, b) => {
  const g = (a.group || '').toString().localeCompare((b.group || '').toString(), 'ru', { sensitivity: 'base' });
  if (g !== 0) return g;
  const br = (a.brand || '').toString().localeCompare((b.brand || '').toString(), 'ru', { sensitivity: 'base' });
  if (br !== 0) return br;
  return parseFloat(a.price || 0) - parseFloat(b.price || 0);
};

// ── Horizontal scroll list ─────────────────────────────────
function renderList(items, containerEl, laneType) {
  const scrollWrap = document.createElement('div');
  scrollWrap.className = 'splash-scroll-container';
  const list = document.createElement('div');
  list.className = 'splash-products-list';

  items.forEach((p, idx) => {
    const card = document.createElement('div');
    card.className = 'splash-product-card';
    card.setAttribute('data-brand', p.brand || '');
    card.setAttribute('data-product-id', p.id || '');

    // Promo lane only: show discount % badge
    const discount = parseFloat(p.text || 0);
    if (laneType === 'promo' && discount > 0) {
      card.innerHTML = `<div class="splash-card-badge"><span class="discount-badge">-${Math.round(discount * 100)}%</span></div>`;
    }

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.draggable = false;
    img.src = p.image || DEFAULT_IMAGE;
    img.alt = '';
    img.onerror = () => { img.src = DEFAULT_IMAGE; };
    card.appendChild(img);
    list.appendChild(card);
    requestAnimationFrame(() => setTimeout(() => card.classList.add('visible'), idx * 15));
  });

  scrollWrap.appendChild(list);
  containerEl.appendChild(scrollWrap);

  // Drag-to-scroll (mouse) — document-level to stay smooth on fast moves
  let isDragging = false, lastX = 0;
  scrollWrap.addEventListener('mousedown', e => {
    isDragging = true;
    lastX = e.clientX;
    scrollWrap.classList.add('dragging');
    e.preventDefault();
    const onMove = ev => {
      if (!isDragging) return;
      scrollWrap.scrollLeft -= ev.clientX - lastX;
      lastX = ev.clientX;
    };
    const onUp = () => {
      isDragging = false;
      scrollWrap.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

/** Determine if a product is food (oof) or non-food (ooh) by its id prefix */
function isFood(productId) {
  return (productId || '').toLowerCase().startsWith('oof');
}

const ARROW_SVG_LEFT  = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="10 3 5 8 10 13"/></svg>`;
const ARROW_SVG_RIGHT = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 3 11 8 6 13"/></svg>`;

// ── Category info texts ────────────────────────────────────
const SPLASH_LANE_INFO = {
  promo: {
    title: 'Акции',
    text: `<p>В данный раздел включены товары, на которые распространяется прямая скидка от производителя или дистрибьютора.</p>
<p><strong>Цель:</strong> Позволить клиенту максимально быстро найти позиции с наилучшим ценовым предложением для повышения маржинальности закупок.</p>`,
  },
  new: {
    title: 'Новинки',
    text: `<p>В этой категории отображаются позиции, которые ранее отсутствовали в активных прайс-листах поставщиков.</p>
<p><strong>Состав:</strong> Сюда попадают как абсолютно новые продукты, так и товары после ребрендинга или изменения наименования в учетной системе поставщика.</p>
<p><strong>Механика:</strong> Выборка формируется автоматически на основе сравнительных алгоритмов.</p>
<p><em>Обратите внимание:</em> Ввиду особенностей автоматической обработки данных, в раздел могут попадать переименованные позиции, которые технически распознаются системой как новые.</p>`,
  },
  arrival: {
    title: 'Поступления',
    text: `<p>Фильтр отображает динамику складских остатков за последний период.</p>
<p><strong>Период:</strong> Товары, поступившие на склады дистрибьюторов в течение последних 14 дней.</p>
<p><strong>Назначение:</strong> Отслеживание восполнения дефицитных позиций и актуального наличия товара.</p>`,
  },
  actual: {
    title: 'Актуальное',
    text: `<p>Тематическая подборка товаров, сформированная с учетом сезонности и приближающихся праздников.</p>
<p><strong>Контент:</strong> Продукция, имеющая повышенный спрос в текущий момент времени (например, сезонный инвентарь или подарочные наборы).</p>`,
  },
  child: {
    title: 'Детское (Специальная подборка)',
    text: `<p>Универсальный фильтр, созданный по запросу специализированных магазинов для работы с детским ассортиментом во всех товарных группах.</p>
<p><strong>Охват:</strong> Система анализирует не только профильные категории (игрушки, игры), но и находит товары для детей в разделах «Хозтовары», «Бытовая химия», «Электрика» и других.</p>
<p><strong>Преимущества:</strong> Товары с маркировкой «Детское» (особенно в косметике и химии), как правило, обладают улучшенными характеристиками состава и безопасности по сравнению с базовыми аналогами.</p>
<p><strong>Алгоритм формирования:</strong> Выборка осуществляется автоматически путем поиска ключевых слов и свойств в наименованиях.</p>
<p><em>Важно:</em> Поскольку поиск автоматизирован, в список могут попадать единичные позиции смежной тематики. Мы постоянно совершенствуем формулы для повышения точности этого фильтра.</p>`,
  },
  discount: {
    title: 'Уценка',
    text: `<p>В данном разделе представлены товары, имеющие незначительные внешние дефекты, не влияющие на их основной функционал, но требующие реализации по сниженной стоимости.</p>
<p><strong>Информативность:</strong> Для большинства позиций причина снижения цены (например, повреждение упаковки, потертости или сколы) указана непосредственно в наименовании или описании товара.</p>
<p><strong>Ценообразование:</strong> Стоимость товаров в этой категории значительно ниже рыночной, что позволяет компенсировать наличие эстетических недостатков.</p>
<p class="info-warning-pulse"><strong>Важное условие:</strong> Обращаем ваше внимание, что товары из категории «Уценка» не подлежат возврату или обмену. Приобретая данные позиции, покупатель соглашается с текущим состоянием товара.</p>`,
  },
};

// ── Detail modal renderer ──────────────────────────────────
function renderDetailModal(items, laneType) {
  const body = document.getElementById('splash-detail-body');
  if (!body) return;
  body.innerHTML = '';

  // Group: group → subgroup → brand → items
  const grouped = {};
  items.forEach(p => {
    const g = p.group || 'Без группы';
    const s = p.subgroup || 'Без подгруппы';
    const b = p.brand || 'Без бренда';
    if (!grouped[g]) grouped[g] = {};
    if (!grouped[g][s]) grouped[g][s] = {};
    if (!grouped[g][s][b]) grouped[g][s][b] = [];
    grouped[g][s][b].push(p);
  });

  Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'ru')).forEach(g => {
    const gSec = document.createElement('section');
    gSec.className = 'detail-group';
    const gTitle = document.createElement('h2');
    gTitle.className = 'detail-group-title';
    gTitle.textContent = g;
    gSec.appendChild(gTitle);

    Object.keys(grouped[g]).sort((a, b) => a.localeCompare(b, 'ru')).forEach(s => {
      const sSec = document.createElement('div');
      sSec.className = 'detail-subgroup';
      const sTitle = document.createElement('h3');
      sTitle.className = 'detail-subgroup-title';
      sTitle.textContent = s;
      sSec.appendChild(sTitle);

      Object.keys(grouped[g][s]).sort((a, b) => a.localeCompare(b, 'ru')).forEach(b => {
        const bSec = document.createElement('div');
        bSec.className = 'detail-brand';
        const bTitle = document.createElement('h4');
        bTitle.className = 'detail-brand-title';
        bTitle.textContent = b;
        bSec.appendChild(bTitle);

        const wrap = document.createElement('div');
        wrap.className = 'detail-cards-wrap';

        grouped[g][s][b].forEach(p => {
          const discount = parseFloat(p.text || 0);
          const price = parseFloat(p.price || 0);
          let priceHTML = '';
          if (price > 0) {
            if (discount > 0) {
              const old = Math.round(price / (1 - discount));
              priceHTML = `<s class="old-price">${old}</s>&nbsp;<span class="promo-price-preview">${price}</span>`;
            } else {
              priceHTML = `${price} руб`;
            }
          }
          const card = document.createElement('div');
          card.className = 'detail-card';
          card.innerHTML = `<img src="${p.image || DEFAULT_IMAGE}" loading="lazy"><div class="detail-card-name">${p.name || ''}</div><div class="detail-card-price">${priceHTML}</div>`;
          card.querySelector('img').onerror = function() { this.src = DEFAULT_IMAGE; };
          wrap.appendChild(card);
        });

        bSec.appendChild(wrap);
        sSec.appendChild(bSec);
      });
      gSec.appendChild(sSec);
    });
    body.appendChild(gSec);
  });
}

function createSplashBrands(products, containerEl) {
  const foodBrands = {};
  const nonfoodBrands = {};
  products.forEach(p => {
    const brand = p.brand || 'Без бренда';
    if (isFood(p.id)) foodBrands[brand] = (foodBrands[brand] || 0) + 1;
    else nonfoodBrands[brand] = (nonfoodBrands[brand] || 0) + 1;
  });

  const foodList = Object.keys(foodBrands).sort();
  const nonfoodList = Object.keys(nonfoodBrands).sort();
  if (foodList.length + nonfoodList.length < 2) return;

  // Outer wrapper: [← arrow] [scroll area] [→ arrow]
  const wrap = document.createElement('div');
  wrap.className = 'splash-brands-wrap';

  const btnLeft = document.createElement('button');
  btnLeft.type = 'button';
  btnLeft.className = 'splash-brands-arrow splash-brands-arrow-left';
  btnLeft.innerHTML = ARROW_SVG_LEFT;
  btnLeft.setAttribute('aria-label', 'Назад');

  const scrollWrap = document.createElement('div');
  scrollWrap.className = 'splash-brands-scroll';
  const list = document.createElement('div');
  list.className = 'splash-brands-list';

  const btnRight = document.createElement('button');
  btnRight.type = 'button';
  btnRight.className = 'splash-brands-arrow splash-brands-arrow-right';
  btnRight.innerHTML = ARROW_SVG_RIGHT;
  btnRight.setAttribute('aria-label', 'Вперёд');

  const allBrands = [
    ...foodList.map(b => ({ brand: b, count: foodBrands[b], food: true })),
    ...nonfoodList.map(b => ({ brand: b, count: nonfoodBrands[b], food: false })),
  ];

  allBrands.forEach(({ brand, count, food }) => {
    const btn = document.createElement('div');
    btn.className = 'splash-brand-item' + (food ? ' food-brand' : '');
    btn.setAttribute('data-brand', brand);
    btn.innerHTML = `${brand} <span class="splash-brand-counter">(${count})</span>`;
    btn.addEventListener('click', () => {
      btn.classList.add('clicked');
      setTimeout(() => btn.classList.remove('clicked'), 600);

      // Highlight ALL cards of this brand
      const allCards = containerEl.querySelectorAll(`.splash-product-card[data-brand="${CSS.escape(brand)}"]`);
      allCards.forEach(card => {
        card.classList.add('highlighted');
        setTimeout(() => card.classList.remove('highlighted'), 1800);
      });

      // Scroll product lane to first card
      const scrollEl = containerEl.querySelector('.splash-scroll-container');
      if (allCards.length > 0 && scrollEl) {
        const wrapRect = scrollEl.getBoundingClientRect();
        const cardRect = allCards[0].getBoundingClientRect();
        scrollEl.scrollTo({ left: scrollEl.scrollLeft + cardRect.left - wrapRect.left - 16, behavior: 'smooth' });
      }

      // Center this button in the brand row
      const btnRect = btn.getBoundingClientRect();
      const wrapRect2 = scrollWrap.getBoundingClientRect();
      scrollWrap.scrollTo({ left: scrollWrap.scrollLeft + btnRect.left - wrapRect2.left - (wrapRect2.width - btn.offsetWidth) / 2, behavior: 'smooth' });
    });
    list.appendChild(btn);
  });

  scrollWrap.appendChild(list);
  wrap.appendChild(btnLeft);
  wrap.appendChild(scrollWrap);
  wrap.appendChild(btnRight);
  containerEl.insertBefore(wrap, containerEl.firstChild);

  // Arrow state: show/hide based on scroll position
  const SCROLL_STEP = 220;
  function updateArrows() {
    const atStart = scrollWrap.scrollLeft <= 2;
    const atEnd   = scrollWrap.scrollLeft >= scrollWrap.scrollWidth - scrollWrap.clientWidth - 2;
    btnLeft.classList.toggle('hidden', atStart);
    btnRight.classList.toggle('hidden', atEnd);
  }
  scrollWrap.addEventListener('scroll', updateArrows, { passive: true });
  requestAnimationFrame(updateArrows);

  btnLeft.addEventListener('click',  () => scrollWrap.scrollBy({ left: -SCROLL_STEP, behavior: 'smooth' }));
  btnRight.addEventListener('click', () => scrollWrap.scrollBy({ left:  SCROLL_STEP, behavior: 'smooth' }));

  // Wheel: vertical → horizontal
  scrollWrap.addEventListener('wheel', e => {
    if (scrollWrap.scrollWidth <= scrollWrap.clientWidth) return;
    e.preventDefault();
    scrollWrap.scrollLeft += e.deltaY;
  }, { passive: false });

  // Drag-to-scroll (mouse)
  let isDragging = false, lastX = 0;
  scrollWrap.addEventListener('mousedown', e => {
    // Don't start drag when clicking a brand button
    if (e.target.closest('.splash-brand-item')) return;
    isDragging = true;
    lastX = e.clientX;
    scrollWrap.classList.add('dragging');
    e.preventDefault();
    const onMove = ev => {
      if (!isDragging) return;
      scrollWrap.scrollLeft -= ev.clientX - lastX;
      lastX = ev.clientX;
    };
    const onUp = () => {
      isDragging = false;
      scrollWrap.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// ── Product previews ───────────────────────────────────────
export function renderSplashPreviews(promoProducts, newProducts, arrivalProducts, actualProducts, childProducts, discountProducts) {
  const lanes = [
    { gridId: 'splash-promo-grid',    items: promoProducts,    countId: 'splash-promo-count',    laneType: 'promo'    },
    { gridId: 'splash-new-grid',      items: newProducts,      countId: 'splash-new-count',      laneType: 'new'      },
    { gridId: 'splash-arrival-grid',  items: arrivalProducts,  countId: 'splash-arrival-count',  laneType: 'arrival'  },
    { gridId: 'splash-actual-grid',   items: actualProducts,   countId: 'splash-actual-count',   laneType: 'actual'   },
    { gridId: 'splash-child-grid',    items: childProducts,    countId: 'splash-child-count',    laneType: 'child'    },
    { gridId: 'splash-discount-grid', items: discountProducts, countId: 'splash-discount-count', laneType: 'discount' },
  ];

  lanes.forEach(lane => {
    const grid = document.getElementById(lane.gridId);
    if (!grid) return;
    const sorted = (lane.items || []).slice().sort(sortFn);
    const section = grid.closest('.splash-list-section');
    if (sorted.length === 0) {
      if (section) section.style.display = 'none';
      return;
    }
    if (section) section.style.display = '';
    // Store for detail modal
    window._splashLaneData = window._splashLaneData || {};
    window._splashLaneData[lane.laneType] = sorted;
    grid.innerHTML = '';
    renderList(sorted, grid, lane.laneType);
    createSplashBrands(sorted, grid);
    try {
      const countEl = document.getElementById(lane.countId);
      if (countEl) countEl.textContent = String(sorted.length);
    } catch (e) { }
  });
}

// ── Splash icons ──────────────────────────────────────────
export function setSplashIcons() {
  try {
    const icons = {
      'splash-promo-icon': FILTER_IMAGES.promo,
      'splash-new-icon': FILTER_IMAGES.new,
      'splash-arrival-icon': FILTER_IMAGES.arrival,
      'splash-actual-icon': FILTER_IMAGES.actual,
      'splash-child-icon': FILTER_IMAGES.child,
      'splash-discount-icon': FILTER_IMAGES.discount,
    };
    Object.entries(icons).forEach(([id, svg]) => {
      const el = document.getElementById(id);
      if (el && svg) el.innerHTML = svg;
    });
  } catch (e) { console.warn('set splash icons failed', e); }
}

// ── Wheel scroll for splash lists ──────────────────────────
export function enableWheelForSplashLists() {
  document.querySelectorAll('.splash-scroll-container').forEach(container => {
    if (!container || container.__wheelBound) return;
    container.__wheelBound = true;
    container.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (container.scrollWidth <= container.clientWidth) return;
      e.preventDefault();
      container.scrollLeft += e.deltaY;
    }, { passive: false });
  });
}

// ── Enter button → hide splash, show app ───────────────────
// ── PDF download ───────────────────────────────────────────

// Fetch an image URL and return a data URL (bypasses canvas taint)
async function imgToDataURL(src) {
  try {
    const resp = await fetch(src, { mode: 'cors', cache: 'force-cache' });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

async function downloadDetailPDF() {
  const body = document.getElementById('splash-detail-body');
  const titleEl = document.getElementById('splash-detail-title');
  const printBtn = document.getElementById('splash-detail-print');
  if (!body) return;

  const origHTML = printBtn?.innerHTML || '';
  if (printBtn) { printBtn.disabled = true; printBtn.innerHTML = '…'; }

  let clone = null;
  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);

    // ── 1. Convert all images to data URLs before capture ─
    const origImgs = Array.from(body.querySelectorAll('img'));
    const dataURLs = await Promise.all(origImgs.map(img => imgToDataURL(img.src)));

    // ── 2. Clone into off-screen fixed-width container ────
    const A4_PX = 794; // 210mm @ 96dpi
    clone = body.cloneNode(true);
    Object.assign(clone.style, {
      position: 'absolute', top: '-9999px', left: '0',
      width: A4_PX + 'px', overflow: 'visible',
      background: '#fff', zIndex: '-1',
    });
    document.body.appendChild(clone);

    // Replace img srcs in clone with data URLs
    const cloneImgs = Array.from(clone.querySelectorAll('img'));
    cloneImgs.forEach((img, i) => {
      img.loading = 'eager';
      if (dataURLs[i]) img.src = dataURLs[i];
    });

    // Wait for layout + any remaining image loads
    await new Promise(r => setTimeout(r, 300));
    await Promise.all(cloneImgs.map(img =>
      img.complete ? Promise.resolve() : new Promise(r => {
        img.onload = img.onerror = r;
      })
    ));

    // ── 3. Collect brand-block bottom positions in clone ──
    const cloneRect = clone.getBoundingClientRect();
    const SCALE = 2;
    const brandBottomsPx = Array.from(clone.querySelectorAll('.detail-brand')).map(el => {
      const r = el.getBoundingClientRect();
      return (r.bottom - cloneRect.top) * SCALE;
    });

    // ── 4. Capture clone ──────────────────────────────────
    const canvas = await html2canvas(clone, {
      scale: SCALE,
      useCORS: false,    // data URLs are same-origin, no CORS needed
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      width: A4_PX,
      windowWidth: A4_PX,
      scrollX: 0,
      scrollY: -window.scrollY,
    });

    document.body.removeChild(clone);
    clone = null;

    // ── 5. Build smart cut points (between brand blocks) ──
    const PDF_W = 210;
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const PAGE_H_MM = pdf.internal.pageSize.getHeight();
    const pxPerMm = canvas.width / PDF_W;
    const pageHpx = PAGE_H_MM * pxPerMm;

    const cuts = [0];
    let cursor = 0;
    while (cursor < canvas.height) {
      const ideal = cursor + pageHpx;
      if (ideal >= canvas.height) break;
      const valid = brandBottomsPx.filter(b => b > cursor + 10 && b <= ideal);
      const cut = valid.length > 0 ? valid[valid.length - 1] : ideal;
      cuts.push(cut);
      cursor = cut;
    }
    cuts.push(canvas.height);

    // ── 6. Render each slice as a PDF page ────────────────
    for (let i = 0; i < cuts.length - 1; i++) {
      const sy = cuts[i];
      const sh = cuts[i + 1] - sy;
      const pg = document.createElement('canvas');
      pg.width = canvas.width;
      pg.height = sh;
      const ctx = pg.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, pg.width, sh);
      ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);
      if (i > 0) pdf.addPage();
      pdf.addImage(pg.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, PDF_W, sh / pxPerMm);
    }

    const title = (titleEl?.textContent || 'список').replace(/[^a-zа-яё0-9]/gi, '_');
    pdf.save(`${title}.pdf`);

  } catch (err) {
    console.error('PDF error', err);
    window.print();
  } finally {
    if (clone && clone.parentNode) clone.parentNode.removeChild(clone);
    if (printBtn) { printBtn.disabled = false; printBtn.innerHTML = origHTML; }
  }
}

export function initSplashListeners() {
  const splash = document.getElementById('splash-screen');
  const appContent = document.getElementById('app-content');
  const enterBtn = document.getElementById('splash-enter-btn');

  // Edit mode: hide auth controls
  const _editParams = new URLSearchParams(window.location.search);
  if (_editParams.get('edit_order') && _editParams.get('edit_token')) {
    const authCtrl = document.getElementById('splash-auth-controls');
    const enterCtrl = document.getElementById('splash-enter-controls');
    const loggedAs = document.getElementById('splash-logged-as');
    if (authCtrl) authCtrl.style.display = 'none';
    if (enterCtrl) enterCtrl.style.display = 'none';
    if (loggedAs) { loggedAs.style.display = 'block'; loggedAs.textContent = '⏳ Загружаем заказ для редактирования…'; }
  }

  if (enterBtn && splash && appContent) {
    enterBtn.addEventListener('click', () => {
      splash.classList.add('exit');
      setTimeout(() => {
        splash.classList.add('hidden');
        appContent.classList.add('visible');
        enableWheelForAllLanes();
      }, 600);
    });
  }

  // Info button handlers
  document.querySelectorAll('.splash-info-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const info = SPLASH_LANE_INFO[btn.dataset.lane];
      if (!info || !info.text) return;
      document.getElementById('splash-info-title').textContent = info.title;
      document.getElementById('splash-info-body').innerHTML = info.text;
      document.getElementById('splash-info-modal').classList.add('active');
    });
  });
  document.getElementById('splash-info-close')?.addEventListener('click', () => {
    document.getElementById('splash-info-modal').classList.remove('active');
  });
  document.getElementById('splash-info-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('active');
  });

  // Detail button handlers
  document.querySelectorAll('.splash-detail-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lane = btn.dataset.lane;
      const items = (window._splashLaneData && window._splashLaneData[lane]) || [];
      const info = SPLASH_LANE_INFO[lane];
      document.getElementById('splash-detail-title').textContent = info?.title || lane;
      renderDetailModal(items, lane);
      document.getElementById('splash-detail-modal').classList.add('active');
    });
  });
  document.getElementById('splash-detail-close')?.addEventListener('click', () => {
    document.getElementById('splash-detail-modal').classList.remove('active');
  });
  document.getElementById('splash-detail-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('active');
  });
  document.getElementById('splash-detail-print')?.addEventListener('click', () => downloadDetailPDF());

  // Register / Login modal triggers
  const regBtn = document.getElementById('splash-register-btn');
  const logBtn = document.getElementById('splash-login-btn');
  if (regBtn) regBtn.addEventListener('click', () => {
    const m = document.querySelector('.register-modal');
    if (m) m.classList.add('active');
  });
  if (logBtn) logBtn.addEventListener('click', () => {
    const m = document.querySelector('.login-modal');
    if (m) m.classList.add('active');
  });
  document.querySelectorAll('.close-register').forEach(b => {
    b.addEventListener('click', () => document.querySelector('.register-modal')?.classList.remove('active'));
  });
  document.querySelectorAll('.close-login').forEach(b => {
    b.addEventListener('click', () => document.querySelector('.login-modal')?.classList.remove('active'));
  });
}

// ── Enable enter button when data loaded ───────────────────
export function enableEnterButton() {
  const enterBtn = document.getElementById('splash-enter-btn');
  if (enterBtn) {
    enterBtn.disabled = false;
    enterBtn.classList.add('ready');
  }
  // Hide progress bar and counters
  const loaderWrap = document.querySelector('#splash-screen .loader-wrap');
  const progress = document.querySelector('#splash-screen .splash-progress');
  if (loaderWrap) loaderWrap.style.display = 'none';
  if (progress) progress.style.display = 'none';
}
