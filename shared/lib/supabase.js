import { createClient } from '@supabase/supabase-js';

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SUPA_SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Main client (with session persistence for email auth)
export const sb = createClient(SUPA_URL, SUPA_ANON_KEY);

// Anon client without session (for code-mode users — no auth state)
export const sbAnon = createClient(SUPA_URL, SUPA_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Admin client (only available when service role key is set — admin pages only)
export const sbAdmin = SUPA_SERVICE_KEY
  ? createClient(SUPA_URL, SUPA_SERVICE_KEY)
  : null;
