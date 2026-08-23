import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
}));

const { signInWithPasswordMock, setSessionMock, signOutMock, getUserByEmailMock } = vi.hoisted(
  () => ({
    signInWithPasswordMock: vi.fn(),
    setSessionMock: vi.fn(),
    signOutMock: vi.fn(),
    getUserByEmailMock: vi.fn(),
  })
);

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      signInWithPassword: signInWithPasswordMock,
      setSession: setSessionMock,
      signOut: signOutMock,
    },
  },
}));

vi.mock('./db', () => ({
  getUserByEmail: getUserByEmailMock,
}));

vi.mock('../utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { createAuthUser, restoreSession, signIn } from './authService';

describe('signIn', () => {
  beforeEach(() => {
    signInWithPasswordMock.mockReset();
    setSessionMock.mockReset();
    signOutMock.mockReset();
    getUserByEmailMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('autentica por e-mail antes de consultar o perfil protegido', async () => {
    const profile = { id: 'user-1', email: 'usuario@example.com', ativo: true, role: 'user' };
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'usuario@example.com' } },
      error: null,
    });
    getUserByEmailMock.mockResolvedValue(profile);

    const result = await signIn(' Usuario@Example.com ', 'senha-segura');

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: 'usuario@example.com',
      password: 'senha-segura',
    });
    expect(getUserByEmailMock).toHaveBeenCalledAfter(signInWithPasswordMock);
    expect(result).toEqual({ user: profile, error: null });
  });

  it('autentica nickname no servidor sem consultar perfis pelo cliente anônimo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'access', refresh_token: 'refresh' }),
      })
    );
    setSessionMock.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'usuario@example.com' } },
      error: null,
    });
    getUserByEmailMock.mockResolvedValue({
      id: 'user-1',
      email: 'usuario@example.com',
      ativo: true,
      role: 'user',
    });

    const result = await signIn('apelido', 'senha-segura');

    expect(signInWithPasswordMock).not.toHaveBeenCalled();
    expect(setSessionMock).toHaveBeenCalledWith({
      access_token: 'access',
      refresh_token: 'refresh',
    });
    expect(getUserByEmailMock).toHaveBeenCalledWith('usuario@example.com');
    expect(result.error).toBeNull();
  });

  it('encerra a sessão autenticada quando o perfil interno não existe', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: 'auth-only', email: 'sem-perfil@example.com' } },
      error: null,
    });
    getUserByEmailMock.mockResolvedValue(null);

    const result = await signIn('sem-perfil@example.com', 'senha-segura');

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      user: null,
      error: 'Perfil de usuário não encontrado. Contate o administrador.',
    });
  });

  it('encerra a sessão autenticada quando o perfil está inativo', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'inativo@example.com' } },
      error: null,
    });
    getUserByEmailMock.mockResolvedValue({
      id: 'user-1',
      email: 'inativo@example.com',
      ativo: false,
      role: 'user',
    });

    const result = await signIn('inativo@example.com', 'senha-segura');

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(result.error).toContain('desativada');
  });
});

describe('restoreSession', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    signOutMock.mockReset();
    getUserByEmailMock.mockReset();
  });

  it('restaura o perfil ativo associado à sessão Supabase', async () => {
    const profile = { id: 'user-1', email: 'usuario@example.com', ativo: true, role: 'user' };
    getSessionMock.mockResolvedValue({
      data: { session: { user: { email: 'usuario@example.com' } } },
    });
    getUserByEmailMock.mockResolvedValue(profile);

    await expect(restoreSession()).resolves.toBe(profile);
    expect(getUserByEmailMock).toHaveBeenCalledWith('usuario@example.com');
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it.each([
    ['perfil ausente', null],
    ['perfil inativo', { id: 'user-1', email: 'usuario@example.com', ativo: false, role: 'user' }],
  ])('encerra a sessão restaurada quando há %s', async (_scenario, profile) => {
    getSessionMock.mockResolvedValue({
      data: { session: { user: { email: 'usuario@example.com' } } },
    });
    getUserByEmailMock.mockResolvedValue(profile);

    await expect(restoreSession()).resolves.toBeNull();
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  it('não consulta perfil quando não existe sessão', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });

    await expect(restoreSession()).resolves.toBeNull();
    expect(getUserByEmailMock).not.toHaveBeenCalled();
    expect(signOutMock).not.toHaveBeenCalled();
  });
});

describe('createAuthUser', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('retorna userId quando a edge function responde com sucesso', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: 'token-valido' } },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'application/json' : null),
        },
        json: async () => ({ user_id: 'auth-user-id' }),
      })
    );

    const result = await createAuthUser('novo@empresa.com', '123456');

    expect(result).toEqual({ success: true, userId: 'auth-user-id' });
  });

  it('retorna mensagem orientativa quando a função não está deployada (404)', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: 'token-valido' } },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'application/json' : null),
        },
        json: async () => ({ error: 'Not Found' }),
      })
    );

    const result = await createAuthUser('novo@empresa.com', '123456');

    expect(result.success).toBe(false);
    expect(result.error).toContain('admin-create-user');
    expect(result.error).toContain('deploy');
  });
});
