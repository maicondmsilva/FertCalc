import { createClient } from '@supabase/supabase-js';
import { authStorage } from './authStorage';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error(
    'VITE_SUPABASE_URL is not defined in environment variables. Please set it in AI Studio Secrets.'
  );
}
if (!supabaseAnonKey) {
  throw new Error(
    'VITE_SUPABASE_ANON_KEY is not defined in environment variables. Please set it in AI Studio Secrets.'
  );
}

/**
 * A sessão é renovada enquanto a página estiver aberta e armazenada apenas na sessão
 * do navegador. Fechar o navegador descarta as credenciais locais.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storage: authStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
