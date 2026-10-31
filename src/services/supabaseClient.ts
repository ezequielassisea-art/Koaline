import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabase = url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
export const requireSupabase = () => {
  if (!supabase) throw new Error('Autenticação não configurada. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  return supabase;
};
