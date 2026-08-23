import type { ReactNode } from 'react';
import type { User } from '../types';
import Login from '../components/Login';
import ResetPassword from '../components/ResetPassword';

interface AppAccessGateProps {
  currentUser: User | null;
  isPasswordReset: boolean;
  onLogin: (user: User) => void;
  onPasswordChanged: (user: User) => void;
  children: (currentUser: User) => ReactNode;
}

export default function AppAccessGate({
  currentUser,
  isPasswordReset,
  onLogin,
  onPasswordChanged,
  children,
}: AppAccessGateProps) {
  if (isPasswordReset) return <ResetPassword />;
  if (!currentUser) return <Login onLogin={onLogin} />;

  if (currentUser.requer_alteracao_senha) {
    return (
      <Login
        onLogin={onLogin}
        forceChangePasswordUserId={currentUser.id}
        onPasswordChanged={onPasswordChanged}
      />
    );
  }

  return children(currentUser);
}
