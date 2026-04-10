import React, { useState, useEffect } from 'react';
import { Lock, Leaf, CheckCircle2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { logger } from '../utils/logger';

/**
 * Página de redefinição de senha — acessada pelo link enviado por e-mail.
 * Supabase Auth injeta automaticamente os tokens via fragment (#access_token=...)
 * quando o usuário clica no link de recuperação.
 */
export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // O Supabase Auth processa automaticamente o hash fragment (#access_token=...)
    // e restaura a sessão. Esperamos o evento SIGNED_IN ou PASSWORD_RECOVERY.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setSessionReady(true);
      }
    });

    // Verificar se já existe sessão (caso o evento já tenha sido disparado)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        logger.warn('[ResetPassword] updateUser error:', updateError.message);
        setError('Erro ao redefinir a senha. Tente novamente ou solicite um novo link.');
      } else {
        setSuccess(true);
        // Deslogar para forçar login com a nova senha
        await supabase.auth.signOut();
      }
    } catch (err) {
      logger.error('[ResetPassword] Unexpected error:', err);
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-stone-200 transition-all duration-300">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
            <Leaf className="w-8 h-8 text-emerald-600" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-black text-stone-800 tracking-tight">
            FertCalc <span className="text-emerald-600">Pro</span>
          </h1>
          <p className="text-stone-500 text-sm mt-2">Redefinir sua senha</p>
        </div>

        {success ? (
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-stone-800 mb-2">Senha redefinida com sucesso!</p>
              <p className="text-sm text-stone-500">
                Agora você pode acessar o sistema com sua nova senha.
              </p>
            </div>
            <a
              href="/"
              className="inline-block w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-emerald-200 text-center"
            >
              Ir para o Login
            </a>
          </div>
        ) : !sessionReady ? (
          <div className="text-center space-y-4">
            <p className="text-stone-500 text-sm">Verificando seu link de recuperação...</p>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
            </div>
            <p className="text-xs text-stone-400">
              Se esta página não carregar em alguns segundos, o link pode ter expirado.{' '}
              <a href="/" className="text-emerald-600 hover:text-emerald-700 font-bold">
                Solicite um novo link
              </a>
              .
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {error && (
              <div
                role="alert"
                className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100"
              >
                {error}
              </div>
            )}
            <div>
              <label
                htmlFor="new-password"
                className="block text-sm font-medium text-stone-700 mb-1"
              >
                Nova Senha
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400 w-4 h-4"
                  aria-hidden="true"
                />
                <input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="confirm-password"
                className="block text-sm font-medium text-stone-700 mb-1"
              >
                Confirmar Nova Senha
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400 w-4 h-4"
                  aria-hidden="true"
                />
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="Repita a nova senha"
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-emerald-200 active:scale-[0.98]"
            >
              {loading ? 'Redefinindo...' : 'Redefinir Senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
