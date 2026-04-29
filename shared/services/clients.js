import { sb } from '../lib/supabase.js';

// ── Registration ────────────────────────────────────────────

/**
 * Check for duplicate client by name, type, INN, or address.
 */
export async function checkDuplicate({ name, type, inn, address }) {
  const { data, error } = await sb.rpc('check_duplicate_client', {
    p_name: name || null,
    p_type: type || null,
    p_inn: inn || null,
    p_address: address || null,
  });
  if (error) throw error;
  return data; // array of matches
}

/**
 * Check if INN already exists in the database.
 */
export async function checkInnExists(inn) {
  const { data, error } = await sb.rpc('check_inn_exists', { p_inn: inn });
  if (error) throw error;
  return data; // boolean or match info
}

/**
 * Submit registration request.
 */
export async function submitRegistration(requestData) {
  const { data, error } = await sb.from('registration_requests').insert(requestData).select().single();
  if (error) throw error;
  return data;
}

// ── Client questions (support) ──────────────────────────────

export async function submitQuestion({ userId, userName, question }) {
  const { data, error } = await sb.from('client_questions').insert({
    user_id: userId || null,
    user_name: userName || '',
    question,
    status: 'new',
  }).select().single();
  if (error) throw error;
  return data;
}
