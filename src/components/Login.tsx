import React, { useState } from 'react';
import { ArrowLeft, KeyRound, LogOut, MailCheck } from 'lucide-react';
import type { User } from '../types';
import AuthLayout from './auth/AuthLayout';
import {
  AuthAlert,
  AuthField,
  NewPasswordFields,
  PasswordInput,
  SubmitButton,
  authInputClass,
} from './auth/AuthFields';
import { isValidEmail, loginProblem, newPasswordProblem } from './auth/passwordRules';

interface LoginProps {
  onLogin: (user: User) => void;
  /** Usuário logado que precisa trocar a senha provisória antes de entrar. */
  forceChangePasswordUserId?: string;
  onPasswordChanged?: (user: User) => void;
  /** Sair da tela de primeiro acesso (volta para o login). */
  onSignOut?: () => void;
}

type View = 'login' | 'forgot';

// Serviços carregados sob demanda: a tela abre sem esperar o cliente do banco.
const authService = () => import('../services/authService');

/**
 * Acesso ao sistema: entrar, recuperar senha e trocar a senha provisória no
 * primeiro acesso. As regras ficam em auth/passwordRules e a comunicação com o
 * Supabase em services/authService.
 */
export default function Login({
  onLogin,
  forceChangePasswordUserId,
  onPasswordChanged,
  onSignOut,
}: LoginProps) {
  if (forceChangePasswordUserId) {
    return (
      <FirstAccess
        userId={forceChangePasswordUserId}
        onPasswordChanged={onPasswordChanged}
        onSignOut={onSignOut}
      />
    );
  }
  return <SignIn onLogin={onLogin} />;
}

function SignIn({ onLogin }: { onLogin: (user: User) => void }) {
  const [view, setView] = useState<View>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const problem = loginProblem(identifier, password);
    if (problem) {
      setError(problem);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [{ startBrowserSession }, { signIn }] = await Promise.all([
        import('../services/authStorage'),
        authService(),
      ]);
      startBrowserSession();
      const { user, error: authError } = await signIn(identifier, password);
      if (authError || !user) {
        setError(authError || 'Não foi possível entrar agora. Tente novamente.');
        setPassword('');
        return;
      }
      onLogin(user);
    } catch {
      setError('Sem conexão com o servidor. Verifique a internet.');
    } finally {
      setLoading(false);
    }
  };

  if (view === 'forgot') {
    return (
      <ForgotPassword
        initialEmail={isValidEmail(identifier) ? identifier.trim() : ''}
        onBack={() => {
          setView('login');
          setError('');
        }}
      />
    );
  }

  return (
    <AuthLayout title="Entrar">
      <form onSubmit={submit} className="space-y-5" noValidate>
        {error && <AuthAlert kind="error">{error}</AuthAlert>}
        <AuthField label="E-mail ou usuário">
          {(id) => (
            <input
              id={id}
              type="text"
              inputMode="email"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              placeholder="seu@email.com ou joao.silva"
              disabled={loading}
              className={authInputClass}
            />
          )}
        </AuthField>
        <AuthField
          label="Senha"
          action={
            <button
              type="button"
              onClick={() => {
                setView('forgot');
                setError('');
              }}
              className="text-sm font-bold text-emerald-200 hover:text-white"
            >
              Esqueceu a senha?
            </button>
          }
        >
          {(id) => (
            <PasswordInput
              id={id}
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              placeholder="••••••••"
              disabled={loading}
            />
          )}
        </AuthField>
        <SubmitButton loading={loading} loadingLabel="Entrando…">
          Entrar
        </SubmitButton>
        <p className="text-center text-xs text-emerald-100/60">
          A sessão fica ativa enquanto o navegador estiver aberto.
        </p>
      </form>
    </AuthLayout>
  );
}

function ForgotPassword({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidEmail(email)) {
      setError('Informe um e-mail válido.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { resetPassword } = await authService();
      const { success, message } = await resetPassword(email.trim().toLowerCase());
      if (success) setSentTo(email.trim());
      else setError(message);
    } catch {
      setError('Sem conexão com o servidor. Verifique a internet.');
    } finally {
      setLoading(false);
    }
  };

  const back = (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/20 text-[15px] font-bold text-white hover:bg-white/10"
    >
      <ArrowLeft className="h-4 w-4" /> Voltar para o login
    </button>
  );

  if (sentTo) {
    return (
      <AuthLayout title="Confira seu e-mail">
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-300/40 bg-emerald-400/15 p-4 text-sm text-emerald-50">
            <MailCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p role="status">
              Se <strong>{sentTo}</strong> estiver cadastrado, você vai receber um link para criar
              uma nova senha. Veja também a caixa de spam.
            </p>
          </div>
          {back}
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Recuperar senha"
      subtitle="Enviaremos um link para você criar uma nova senha."
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        {error && <AuthAlert kind="error">{error}</AuthAlert>}
        <AuthField label="E-mail de cadastro">
          {(id) => (
            <input
              id={id}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              autoFocus
              placeholder="seu@email.com"
              disabled={loading}
              className={authInputClass}
            />
          )}
        </AuthField>
        <SubmitButton loading={loading} loadingLabel="Enviando…">
          Enviar link
        </SubmitButton>
        {back}
      </form>
    </AuthLayout>
  );
}

function FirstAccess({
  userId,
  onPasswordChanged,
  onSignOut,
}: {
  userId: string;
  onPasswordChanged?: (user: User) => void;
  onSignOut?: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      const { completeFirstAccess } = await authService();
      const { user, error: saveError } = await completeFirstAccess(userId, password);
      if (saveError || !user) {
        setError(saveError || 'Não foi possível salvar a nova senha.');
        return;
      }
      onPasswordChanged?.(user);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Crie sua senha"
      subtitle="Primeiro acesso: troque a senha provisória antes de continuar."
      tone="amber"
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-300/40 bg-amber-400/15 px-4 py-3 text-sm text-amber-100">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Por segurança, a senha enviada pelo administrador só vale para este primeiro acesso.
          </span>
        </div>
        {error && <AuthAlert kind="error">{error}</AuthAlert>}
        <NewPasswordFields
          password={password}
          confirmation={confirmation}
          onPasswordChange={setPassword}
          onConfirmationChange={setConfirmation}
          disabled={loading}
        />
        <SubmitButton loading={loading} loadingLabel="Salvando…" tone="amber">
          Salvar senha e entrar
        </SubmitButton>
        {onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            disabled={loading}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-emerald-100 hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" /> Sair e entrar com outra conta
          </button>
        )}
      </form>
    </AuthLayout>
  );
}
