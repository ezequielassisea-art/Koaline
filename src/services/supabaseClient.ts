import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
console.log('VITE_SUPABASE_URL:', supabaseUrl);
console.log('VITE_SUPABASE_ANON_KEY existe?', !!supabaseAnonKey);
const isSupabaseConfigured = Boolean(supabaseUrl?.trim() && supabaseAnonKey?.trim());

if (!isSupabaseConfigured) {
  console.error('ERRO CRÍTICO: Variáveis do Supabase não encontradas no Vite. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente de build.');
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!.trim(), supabaseAnonKey!.trim(), { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;
export const requireSupabase = () => {
  if (!supabase) throw new Error('Autenticação não configurada. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  return supabase;
};
