// ── Product loading with pagination ─────────────────────────
// Uses REST API directly for pagination with Content-Range headers

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Load all products from Supabase with pagination.
 * @param {object} opts
 * @param {number} opts.batchSize — products per request (default 1000)
 * @param {function} opts.onProgress — (percent, loaded, total) => void
 * @returns {Promise<Array>} all products
 */
export async function loadAllProducts({ batchSize = 1000, onProgress } = {}) {
  let allProducts = [];
  let start = 0;
  let hasMore = true;
  let totalCount = null;

  while (hasMore) {
    const response = await fetch(
      `${SUPA_URL}/rest/v1/products?select=*&order=id.asc&limit=${batchSize}&offset=${start}&apikey=${SUPA_KEY}`,
      {
        headers: {
          Range: `${start}-${start + batchSize - 1}`,
          Prefer: 'count=exact',
        },
      }
    );

    if (!response.ok) {
      console.error('Product load error:', response.status, response.statusText);
      break;
    }

    const data = await response.json();
    allProducts = allProducts.concat(data);

    // Parse total from Content-Range header
    if (!totalCount) {
      try {
        const cr = response.headers.get('content-range') || response.headers.get('Content-Range');
        if (cr) {
          const m = cr.match(/\/(\d+)$/);
          if (m) totalCount = parseInt(m[1], 10);
        }
      } catch (e) { /* ignore */ }
    }

    const percent = totalCount
      ? Math.round((allProducts.length / totalCount) * 100)
      : Math.min(99, Math.round(allProducts.length / batchSize * 10));

    onProgress?.(percent, allProducts.length, totalCount);

    if (data.length < batchSize) {
      hasMore = false;
      onProgress?.(100, allProducts.length, totalCount || allProducts.length);
    } else {
      start += batchSize;
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return allProducts;
}

/**
 * Get filter icons for a product based on its `dop` and `name` fields.
 * @param {object} product
 * @param {object} filterImages — map of type → image URL
 * @returns {Array<{type: string, url: string}>}
 */
export function getFilterIcons(product, filterImages) {
  const icons = [];
  const dop = product.dop || '';
  const name = product.name || '';

  if (dop.includes('акция!!!') || dop.includes('распродажа!!!')) {
    const discount = parseFloat(product.text);
    if (discount > 0) {
      const pct = Math.round(discount * 100);
      icons.push({ type: 'promo', url: `<span class="discount-badge">-${pct}%</span>`, isHTML: true });
    } else {
      icons.push({ type: 'promo', url: filterImages.promo });
    }
  }
  if (name.includes('🆕'))
    icons.push({ type: 'new', url: filterImages.new });
  if (dop.includes('поступление'))
    icons.push({ type: 'arrival', url: filterImages.arrival });
  if (dop.includes('актуально'))
    icons.push({ type: 'actual', url: filterImages.actual });
  if (dop.toLowerCase().includes('детское'))
    icons.push({ type: 'child', url: filterImages.child });
  if (dop.toLowerCase().includes('уценка'))
    icons.push({ type: 'discount', url: filterImages.discount });

  return icons;
}

/**
 * Format product info line with price, unit, stock, and optional old price.
 * @param {object} product
 * @returns {string} HTML string
 */
export function formatProductInfo(product) {
  const price = parseFloat(product.price) || 0;
  const unit = product.unit || '';
  const stock = product.stock ?? '';
  const multiple = product.multiple || '1';
  const discount = parseFloat(product.text);

  let html = '';
  if (discount > 0) {
    const oldPrice = Math.round(price / (1 - discount));
    html += `<s class="old-price">${oldPrice}</s> `;
  }
  html += `${price} руб. / ${unit} (остаток: ${stock})`;
  if (multiple && multiple !== '1' && multiple !== 1) {
    html += ` кратность заказа - ${multiple}`;
  }
  return html;
}
