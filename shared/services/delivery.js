import { sb } from '../lib/supabase.js';

// ── Delivery schedule calculation ───────────────────────────

function _getISOWeek(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

/**
 * Get next N delivery dates for given schedule entries.
 * @param {Array} schedules — [{day_of_week, week_parity}]
 * @param {number} count
 * @returns {Date[]}
 */
export function getNextDates(schedules, count = 5) {
  const results = [];
  const d = new Date();
  let tries = 0;

  while (results.length < count && tries < 90) {
    d.setDate(d.getDate() + 1);
    tries++;
    const dow = d.getDay() === 0 ? 7 : d.getDay();
    const weekNum = _getISOWeek(d);
    const isEven = weekNum % 2 === 0;

    const match = schedules.find((s) => {
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

/**
 * Format schedule as human-readable Russian text.
 * e.g. "по вторникам и пятницам" / "по средам (чётные недели)"
 */
export function formatScheduleText(schedules) {
  const DAYS = ['', 'понедельникам', 'вторникам', 'средам', 'четвергам', 'пятницам', 'субботам', 'воскресеньям'];
  if (!schedules?.length) return '';

  const parity = schedules[0].week_parity;
  const days = schedules
    .sort((a, b) => a.day_of_week - b.day_of_week)
    .map((s) => DAYS[s.day_of_week]);

  const daysStr = days.length === 1
    ? 'по ' + days[0]
    : 'по ' + days.slice(0, -1).join(', ') + ' и ' + days[days.length - 1];

  const freqStr = parity === 'even' ? ' (чётные недели)'
    : parity === 'odd' ? ' (нечётные недели)'
    : '';

  return 'Вывоз ' + daysStr + freqStr;
}

/**
 * Lookup delivery directions and schedules for a city name.
 * @param {string} cityName — e.g. "Уссурийск", "Раздольное"
 * @returns {{ directions: Array, schedules: Array } | null}
 */
export async function lookupDeliveryByCity(cityName) {
  if (!cityName) return null;

  // Find locality
  const { data: localities } = await sb
    .from('localities')
    .select('id, name')
    .ilike('name', `%${cityName}%`)
    .limit(5);

  if (!localities?.length) return null;

  const locIds = localities.map((l) => l.id);

  // Find direction links
  const { data: dirLinks } = await sb
    .from('direction_localities')
    .select('direction_id')
    .in('locality_id', locIds);

  if (!dirLinks?.length) return null;

  const dirIds = [...new Set(dirLinks.map((d) => d.direction_id))];

  // Load directions + schedules
  const [dirsRes, schedRes] = await Promise.all([
    sb.from('delivery_directions').select('*').in('id', dirIds),
    sb.from('direction_schedules').select('*').in('direction_id', dirIds),
  ]);

  return {
    directions: dirsRes.data || [],
    schedules: schedRes.data || [],
  };
}

/**
 * Get all delivery directions for a specific client.
 */
export async function getClientDirections(clientId) {
  const { data, error } = await sb.rpc('get_client_directions', { p_client_id: clientId });
  if (error) throw error;
  return data;
}
