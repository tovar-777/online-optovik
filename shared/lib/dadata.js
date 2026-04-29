const DADATA_TOKEN = import.meta.env.VITE_DADATA_TOKEN;
const SUGGEST_URL = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest';

let _timer = null;

// ── Address suggestions (city / street / house) ─────────────
export function dadataQuery(fieldType, query, cityHint, { onResults, onEmpty, debounceMs = 400 } = {}) {
  if (!query || query.length < 2) {
    onEmpty?.();
    return;
  }

  clearTimeout(_timer);
  _timer = setTimeout(async () => {
    try {
      const body = { query, count: 8 };

      if (fieldType === 'city') {
        body.from_bound = { value: 'city' };
        body.to_bound = { value: 'settlement' };
        body.locations = [{ region: 'Приморский' }];
        body.count = 12;
      } else if (fieldType === 'street' || fieldType === 'house') {
        body.from_bound = { value: fieldType };
        body.to_bound = { value: fieldType };

        if (cityHint) {
          const hint = typeof cityHint === 'object' ? cityHint : { text: cityHint };
          if (hint.settlFias) {
            body.locations = [{ settlement_fias_id: hint.settlFias }];
          } else if (hint.cityFias) {
            body.locations = [{ city_fias_id: hint.cityFias }];
          } else {
            const txt = (hint.text || '')
              .replace(/^(г\.|с\.|п\.|пгт\.|пос\.|деревня\s|село\s|город\s)/i, '')
              .replace(/\s*\([^)]*\)/g, '')
              .trim();
            body.locations = txt
              ? [{ region: 'Приморский', city: txt }, { region: 'Приморский', settlement: txt }]
              : [{ region: 'Приморский' }];
          }
        } else {
          body.locations = [{ region: 'Приморский' }];
        }
      }

      const resp = await fetch(`${SUGGEST_URL}/address`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Token ${DADATA_TOKEN}`,
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      let sugg = data.suggestions || [];

      if (!sugg.length) {
        onEmpty?.();
        return;
      }

      // City filtering: remove irrelevant results + disambiguate duplicates
      if (fieldType === 'city') {
        sugg = _filterCitySuggestions(sugg, query);
      }

      // Deduplicate by label
      sugg = _deduplicateSuggestions(sugg, fieldType);

      if (!sugg.length) {
        onEmpty?.();
        return;
      }

      onResults?.(sugg);
    } catch (e) {
      console.error('[dadata] error:', e);
      onEmpty?.();
    }
  }, debounceMs);
}

// ── Organization search (by name or INN) ────────────────────
export async function dadataPartySearch(query, { count = 10, priorityRegion = 'Приморский' } = {}) {
  if (!query || query.length < 2) return [];

  const makeBody = (locations) => ({
    query,
    count,
    ...(locations ? { locations } : {}),
  });

  try {
    // Dual query: Primorsky priority + all Russia
    const [localResp, allResp] = await Promise.all([
      fetch(`${SUGGEST_URL}/party`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Token ${DADATA_TOKEN}`,
        },
        body: JSON.stringify(makeBody([{ region: priorityRegion }])),
      }),
      fetch(`${SUGGEST_URL}/party`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Token ${DADATA_TOKEN}`,
        },
        body: JSON.stringify(makeBody()),
      }),
    ]);

    const localData = localResp.ok ? await localResp.json() : { suggestions: [] };
    const allData = allResp.ok ? await allResp.json() : { suggestions: [] };

    // Merge and deduplicate by INN
    const seen = new Set();
    const merged = [];
    for (const s of [...(localData.suggestions || []), ...(allData.suggestions || [])]) {
      const inn = s.data?.inn;
      if (inn && !seen.has(inn)) {
        seen.add(inn);
        merged.push(s);
      }
    }
    return merged;
  } catch (e) {
    console.error('[dadata] party search error:', e);
    return [];
  }
}

// ── Organization lookup by INN ──────────────────────────────
export async function dadataFindByInn(inn) {
  try {
    const resp = await fetch(
      'https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party',
      {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Token ${DADATA_TOKEN}`,
        },
        body: JSON.stringify({ query: inn }),
      }
    );
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    return data.suggestions || [];
  } catch (e) {
    console.error('[dadata] findByInn error:', e);
    return [];
  }
}

// ── Internal helpers ────────────────────────────────────────

function _filterCitySuggestions(sugg, query) {
  const queryLower = query.toLowerCase().trim();
  const minQ = queryLower.length >= 3 ? queryLower.slice(0, 3) : queryLower;

  sugg = sugg.filter((s) => {
    const d = s.data || {};
    const cityName = (d.city || '').toLowerCase();
    const settlName = (d.settlement || '').toLowerCase();
    return cityName.indexOf(minQ) !== -1 || settlName.indexOf(minQ) !== -1;
  });

  sugg.forEach((s) => {
    const d = s.data || {};
    const hasSettl = !!(d.settlement || d.settlement_with_type);
    const primary = hasSettl
      ? d.settlement_with_type || d.settlement
      : d.city_with_type || d.city || s.value;
    const secondary = hasSettl
      ? d.city_with_type || d.city_district_with_type || d.area_with_type || ''
      : d.area_with_type || '';
    const base = (hasSettl ? d.settlement || '' : d.city || '').toLowerCase();
    s._primary = primary;
    s._secondary = secondary;
    s._base = base;
  });

  // Add district only for duplicate names
  const nameCount = {};
  sugg.forEach((s) => {
    nameCount[s._base] = (nameCount[s._base] || 0) + 1;
  });
  sugg.forEach((s) => {
    const needDisambig =
      nameCount[s._base] > 1 &&
      s._secondary &&
      s._secondary.toLowerCase() !== s._primary.toLowerCase();
    s._label = needDisambig ? `${s._primary} (${s._secondary})` : s._primary;
  });

  return sugg;
}

function _deduplicateSuggestions(sugg, fieldType) {
  const seen = {};
  return sugg.filter((s) => {
    const d = s.data || {};
    let label;
    if (fieldType === 'city') {
      label = s._label || d.city_with_type || d.settlement_with_type || d.city || d.settlement || s.value;
    } else if (fieldType === 'street') {
      label = d.street_with_type || d.street || s.value;
    } else {
      label = d.house
        ? (d.street_with_type
            ? `${d.street_with_type}, д. ${d.house}${d.flat ? ', кв. ' + d.flat : ''}`
            : `д. ${d.house}`)
        : s.value;
    }
    if (!label) label = s.value;
    s._label = label;
    if (seen[label]) return false;
    seen[label] = true;
    return true;
  });
}
