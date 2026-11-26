import type { ReactNode } from 'react';
import type { User } from '../types';
import Login from '../components/Login';
import ResetPassword from '../components/ResetPassword';
import SessionSplash from '../components/auth/SessionSplash';

interface AppAccessGateProps {
  currentUser: User | null;
  /** Conferindo a sessão salva: mostra carregando, não o login. */
  restoring?: boolean;
  isPasswordReset: boolean;
  onLogin: (user: User) => void;
  onPasswordChanged: (user: User) => void;
  /** Sair da tela de primeiro acesso. */
  onLogout?: () => void;
  children: (currentUser: User) => ReactNode;
}

export default function AppAccessGate({
  currentUser,
  restoring = false,
  isPasswordReset,
  onLogin,
  onPasswordChanged,
  onLogout,
  children,
}: AppAccessGateProps) {
  if (isPasswordReset) return <ResetPassword />;
  if (!currentUser && restoring) return <SessionSplash />;
  if (!currentUser) return <Login onLogin={onLogin} />;

  if (currentUser.requer_alteracao_senha) {
    return (
      <Login
        onLogin={onLogin}
        forceChangePasswordUserId={currentUser.id}
        onPasswordChanged={onPasswordChanged}
        onSignOut={onLogout}
      />
    );
  }

  return children(currentUser);
}
