import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';

const auth = vi.hoisted(() => ({
  signIn: vi.fn(),
  resetPassword: vi.fn(),
  completeFirstAccess: vi.fn(),
}));
vi.mock('../../../services/authService', () => auth);
vi.mock('../../../services/authStorage', () => ({ startBrowserSession: vi.fn() }));

import Login from '../../Login';

const user = { id: 'u1', name: 'Ana', email: 'ana@empresa.com', role: 'user' } as never;

beforeEach(() => {
  Object.values(auth).forEach((fn) => fn.mockReset());
});

describe('Login', () => {
  it('valida campos antes de chamar o servidor', async () => {
    render(<Login onLogin={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Informe seu e-mail ou usuário.');
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it('entra e chama onLogin', async () => {
    auth.signIn.mockResolvedValue({ user, error: null });
    const onLogin = vi.fn();
    render(<Login onLogin={onLogin} />);
    fireEvent.change(screen.getByLabelText('E-mail ou usuário'), {
      target: { value: 'ana@empresa.com' },
    });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'segredo1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(onLogin).toHaveBeenCalledWith(user));
    expect(auth.signIn).toHaveBeenCalledWith('ana@empresa.com', 'segredo1');
  });

  it('erro do servidor aparece e limpa a senha', async () => {
    auth.signIn.mockResolvedValue({ user: null, error: 'E-mail/usuário ou senha incorretos.' });
    render(<Login onLogin={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('E-mail ou usuário'), { target: { value: 'ana' } });
    const password = screen.getByLabelText('Senha') as HTMLInputElement;
    fireEvent.change(password, { target: { value: 'errada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('senha incorretos');
    expect(password.value).toBe('');
  });

  it('mostrar/ocultar senha', () => {
    render(<Login onLogin={vi.fn()} />);
    const password = screen.getByLabelText('Senha') as HTMLInputElement;
    expect(password.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(password.type).toBe('text');
  });

  it('recuperar senha: e-mail vem do login e a confirmação não revela se a conta existe', async () => {
    auth.resetPassword.mockResolvedValue({ success: true, message: 'ok' });
    render(<Login onLogin={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('E-mail ou usuário'), {
      target: { value: 'ana@empresa.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Esqueceu a senha?' }));
    expect((screen.getByLabelText('E-mail de cadastro') as HTMLInputElement).value).toBe(
      'ana@empresa.com'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(await screen.findByText(/estiver cadastrado/)).toBeTruthy();
    expect(auth.resetPassword).toHaveBeenCalledWith('ana@empresa.com');
    fireEvent.click(screen.getByRole('button', { name: /Voltar para o login/ }));
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy();
  });

  it('primeiro acesso exige senha forte, conclui e permite sair', async () => {
    auth.completeFirstAccess.mockResolvedValue({ user, error: null });
    const onPasswordChanged = vi.fn();
    const onSignOut = vi.fn();
    render(
      <Login
        onLogin={vi.fn()}
        forceChangePasswordUserId="u1"
        onPasswordChanged={onPasswordChanged}
        onSignOut={onSignOut}
      />
    );
    const [first, second] = [
      screen.getByLabelText('Nova senha'),
      screen.getByLabelText('Confirme a nova senha'),
    ];
    fireEvent.change(first, { target: { value: 'abc' } });
    fireEvent.change(second, { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar senha e entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('8 caracteres');
    expect(auth.completeFirstAccess).not.toHaveBeenCalled();

    fireEvent.change(first, { target: { value: 'Senha123' } });
    fireEvent.change(second, { target: { value: 'Senha123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar senha e entrar' }));
    await waitFor(() => expect(onPasswordChanged).toHaveBeenCalledWith(user));
    expect(auth.completeFirstAccess).toHaveBeenCalledWith('u1', 'Senha123');

    fireEvent.click(screen.getByRole('button', { name: /Sair e entrar com outra conta/ }));
    expect(onSignOut).toHaveBeenCalled();
  });
});
