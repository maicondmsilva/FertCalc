import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../types';
import AppAccessGate from './AppAccessGate';

vi.mock('../components/ResetPassword', () => ({
  default: () => <div>Redefinir senha</div>,
}));

vi.mock('../components/Login', () => ({
  default: ({
    forceChangePasswordUserId,
    onPasswordChanged,
  }: {
    forceChangePasswordUserId?: string;
    onPasswordChanged?: (user: User) => void;
  }) => (
    <div>
      {forceChangePasswordUserId ? `Trocar senha: ${forceChangePasswordUserId}` : 'Entrar'}
      {onPasswordChanged && (
        <button onClick={() => onPasswordChanged(user())}>Senha alterada</button>
      )}
    </div>
  ),
}));

const user = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-1',
    idNumeric: 1,
    email: 'user@example.com',
    name: 'Usuário',
    nickname: 'usuario',
    ativo: true,
    role: 'user',
    ...overrides,
  }) as User;

const renderGate = (
  currentUser: User | null,
  isPasswordReset = false,
  onPasswordChanged = vi.fn()
) =>
  render(
    <AppAccessGate
      currentUser={currentUser}
      isPasswordReset={isPasswordReset}
      onLogin={vi.fn()}
      onPasswordChanged={onPasswordChanged}
    >
      {(authenticatedUser) => <div>Aplicação: {authenticatedUser.id}</div>}
    </AppAccessGate>
  );

afterEach(cleanup);

describe('AppAccessGate', () => {
  it('mantém a redefinição de senha acessível sem autenticação', () => {
    renderGate(null, true);
    expect(screen.getByText('Redefinir senha')).toBeInTheDocument();
  });

  it('exibe o login quando não existe usuário autenticado', () => {
    renderGate(null);
    expect(screen.getByText('Entrar')).toBeInTheDocument();
  });

  it('exige a alteração de senha quando sinalizada no usuário', () => {
    const onPasswordChanged = vi.fn();
    renderGate(user({ requer_alteracao_senha: true }), false, onPasswordChanged);

    expect(screen.getByText('Trocar senha: user-1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Senha alterada' }));
    expect(onPasswordChanged).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1' }));
  });

  it('entrega o usuário validado para a aplicação autenticada', () => {
    renderGate(user());
    expect(screen.getByText('Aplicação: user-1')).toBeInTheDocument();
  });
});
