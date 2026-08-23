import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../types';
import { restoreSession, signOut } from '../services/authService';
import App from '../App';

const currentUser = {
  id: 'user-1',
  idNumeric: 1,
  email: 'user@example.com',
  name: 'Usuário',
  nickname: 'usuario',
  ativo: true,
  role: 'user',
} as User;

vi.mock('../services/authService', () => ({
  restoreSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../components/Login', () => ({
  default: ({ onLogin }: { onLogin: (user: User) => void }) => (
    <section>
      <span>Tela de login</span>
      <button onClick={() => onLogin(currentUser)}>Entrar no FertCalc</button>
    </section>
  ),
}));

vi.mock('../components/ResetPassword', () => ({
  default: () => <div>Redefinição de senha</div>,
}));

vi.mock('./AuthenticatedApp', () => ({
  default: ({ currentUser: user, onLogout }: { currentUser: User; onLogout: () => void }) => (
    <section>
      <span>Área autenticada: {user.name}</span>
      <button onClick={onLogout}>Sair do FertCalc</button>
    </section>
  ),
}));

beforeEach(() => {
  vi.mocked(restoreSession).mockReset().mockResolvedValue(null);
  vi.mocked(signOut).mockReset().mockResolvedValue();
});

afterEach(cleanup);

describe('jornada de autenticação da aplicação', () => {
  it('percorre login, área privada e logout sem montar a área privada antecipadamente', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText('Tela de login')).toBeInTheDocument();
    expect(screen.queryByText(/Área autenticada/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Entrar no FertCalc' }));
    expect(screen.getByText('Área autenticada: Usuário')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sair do FertCalc' }));
    expect(screen.getByText('Tela de login')).toBeInTheDocument();
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('entra diretamente na área privada ao restaurar uma sessão válida', async () => {
    vi.mocked(restoreSession).mockResolvedValue(currentUser);

    render(
      <MemoryRouter initialEntries={['/dashboard?standalone=true']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Área autenticada: Usuário')).toBeInTheDocument());
    expect(restoreSession).toHaveBeenCalledTimes(1);
  });

  it('mantém a recuperação de senha pública mesmo sem sessão', () => {
    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText('Redefinição de senha')).toBeInTheDocument();
    expect(screen.queryByText(/Área autenticada/)).not.toBeInTheDocument();
  });
});
