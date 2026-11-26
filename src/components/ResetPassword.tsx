import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { logger } from '../utils/logger';
import AuthLayout from './auth/AuthLayout';
import { AuthAlert, NewPasswordFields, SubmitButton } from './auth/AuthFields';
import { newPasswordProblem } from './auth/passwordRules';
import { passwordUpdateErrorMessage } from '../services/authService';

/** Espera pelo link do e-mail antes de mostrar "link expirado". */
const LINK_TIMEOUT_MS = 10_000;

/**
 * Nova senha pelo link de recuperação enviado por e-mail. O Supabase Auth lê
 * os dados do link e abre uma sessão de recuperação.
 */
export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [status, setStatus] = useState<'checking' | 'ready' | 'expired'>('checking');

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setStatus('ready');
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setStatus('ready');
    });
    const timer = setTimeout(
      () => setStatus((current) => (current === 'checking' ? 'expired' : current)),
      LINK_TIMEOUT_MS
    );
    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const problem = newPasswordProblem(password, confirmation);
    if (problem) {
      setError(problem);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        logger.warn('[ResetPassword] updateUser error:', updateError.message);
        setError(passwordUpdateErrorMessage(updateError));
        return;
      }
      setSuccess(true);
      // Sai da sessão de recuperação: o próximo acesso usa a nova senha.
      await supabase.auth.signOut();
    } catch (err) {
      logger.error('[ResetPassword] Unexpected error:', err);
      setError('Sem conexão com o servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = (
    <a
      href="/"
      className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-white text-[15px] font-black text-emerald-900 shadow-lg shadow-black/10 hover:bg-emerald-50"
    >
      Ir para o login
    </a>
  );

  if (success) {
    return (
      <AuthLayout title="Senha alterada">
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-300/40 bg-emerald-400/15 p-4 text-sm text-emerald-50">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p role="status">Pronto! Agora entre com a sua nova senha.</p>
          </div>
          {goToLogin}
        </div>
      </AuthLayout>
    );
  }

  if (status !== 'ready') {
    return (
      <AuthLayout title="Redefinir senha">
        {status === 'checking' ? (
          <p role="status" className="flex items-center gap-2 text-sm text-emerald-100/80">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Verificando o link de
            recuperação…
          </p>
        ) : (
          <div className="space-y-5">
            <AuthAlert kind="error">
              Este link expirou ou já foi usado. Peça um novo em “Esqueceu a senha?”.
            </AuthAlert>
            {goToLogin}
          </div>
        )}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Redefinir senha" subtitle="Escolha uma nova senha para sua conta.">
      <form onSubmit={submit} className="space-y-5" noValidate>
        {error && <AuthAlert kind="error">{error}</AuthAlert>}
        <NewPasswordFields
          password={password}
          confirmation={confirmation}
          onPasswordChange={setPassword}
          onConfirmationChange={setConfirmation}
          disabled={loading}
        />
        <SubmitButton loading={loading} loadingLabel="Salvando…">
          Salvar nova senha
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}
