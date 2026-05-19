import { createClient } from '@supabase/supabase-js';

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
 * Supabase client configurado para usar sessão de navegador:
 * - persistSession: true (mantém sessão ativa durante o uso)
 * - storage: sessionStorage (sessão expira ao fechar o navegador)
 *
 * Isso garante que:
 * - Usuário não precisa fazer login a cada reload/navegação
 * - Sessão encerra automaticamente ao fechar o navegador
 * - Não há timeout por inatividade
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storage: window.sessionStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
