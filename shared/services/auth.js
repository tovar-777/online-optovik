import { sb } from '../lib/supabase.js';

const CODE_SESSION_KEY = '_codeSession';

// ── Email auth ──────────────────────────────────────────────

export async function signUpEmail(email, password) {
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signInEmail(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await sb.auth.signOut();
  localStorage.removeItem(CODE_SESSION_KEY);
}

export async function getSession() {
  const { data } = await sb.auth.getSession();
  return data?.session || null;
}

export function onAuthStateChange(callback) {
  return sb.auth.onAuthStateChange(callback);
}

// ── Code auth ───────────────────────────────────────────────

export function getCodeSession() {
  try {
    return JSON.parse(localStorage.getItem(CODE_SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

export function saveCodeSession(session) {
  localStorage.setItem(CODE_SESSION_KEY, JSON.stringify(session));
}

export function clearCodeSession() {
  localStorage.removeItem(CODE_SESSION_KEY);
}

// ── Client profile (for code users) ────────────────────────

export async function getClientProfile(clientId) {
  const { data, error } = await sb.rpc('get_client_profile', { p_client_id: clientId });
  if (error) throw error;
  return data;
}
