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
 * - storage: localStorage (necessário para links de redefinição de senha via e-mail
 *   funcionarem corretamente, pois o link abre em nova aba onde sessionStorage não
 *   seria acessível)
 *
 * Isso garante que:
 * - Usuário não precisa fazer login a cada reload/navegação
 * - Links de recuperação de senha enviados por e-mail funcionam corretamente
 * - Sessão persiste entre abas do mesmo navegador
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storage: window.localStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
