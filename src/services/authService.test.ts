import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionMock, refreshSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  refreshSessionMock: vi.fn(),
}));

const { signInWithPasswordMock, setSessionMock, signOutMock, profileByIdMock } = vi.hoisted(() => ({
  signInWithPasswordMock: vi.fn(),
  setSessionMock: vi.fn(),
  signOutMock: vi.fn(),
  profileByIdMock: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      refreshSession: refreshSessionMock,
      signInWithPassword: signInWithPasswordMock,
      setSession: setSessionMock,
      signOut: signOutMock,
    },
    // Perfil: from('app_users').select('*').eq('id', id).maybeSingle()
    from: () => ({
      select: () => ({
        eq: (_column: string, id: string) => ({
          maybeSingle: async () => ({ data: await profileByIdMock(id), error: null }),
        }),
      }),
    }),
  },
}));

vi.mock('./db', () => ({
  mapUser: (row: unknown) => row,
}));

vi.mock('../utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  adminDeleteAuthUser,
  adminUpdateAuthUser,
  createAuthUser,
  authErrorMessage,
  INVALID_CREDENTIALS,
  passwordUpdateErrorMessage,
  restoreSession,
  signIn,
  signOut,
  TOO_MANY_ATTEMPTS,
} from './authService';

describe('adminUpdateAuthUser', () => {
  const payload = {
    user_id: 'user-1',
    email: 'usuario@example.com',
    name: 'Usuário',
    nickname: 'usuario',
    role: 'user',
    ativo: true,
    managed_user_ids: [],
    permissions: { calculator: true },
    filiais_permitidas: [],
    access_profile_id: 'profile-1',
  };

  beforeEach(() => {
    getSessionMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('envia perfil e permissões para a atualização administrativa', async () => {
    getSessionMock.mockResolvedValue({ data: { session: { access_token: 'token-valido' } } });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user_id: 'user-1' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(adminUpdateAuthUser(payload)).resolves.toEqual({ success: true });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      permissions: { calculator: true },
      access_profile_id: 'profile-1',
    });
  });

  it('explica quando a função de atualização ainda não foi publicada', async () => {
    getSessionMock.mockResolvedValue({ data: { session: { access_token: 'token-valido' } } });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not Found' }),
      })
    );

    const result = await adminUpdateAuthUser(payload);

    expect(result.success).toBe(false);
    expect(result.error).toContain('admin-update-user');
  });
});

describe('signIn', () => {
  beforeEach(() => {
    signInWithPasswordMock.mockReset();
    setSessionMock.mockReset();
    signOutMock.mockReset();
    profileByIdMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('autentica por e-mail antes de consultar o perfil protegido', async () => {
    const profile = { id: 'user-1', email: 'usuario@example.com', ativo: true, role: 'user' };
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'usuario@example.com' } },
      error: null,
    });
    profileByIdMock.mockResolvedValue(profile);

    const result = await signIn(' Usuario@Example.com ', 'senha-segura');

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: 'usuario@example.com',
      password: 'senha-segura',
    });
    expect(profileByIdMock).toHaveBeenCalledAfter(signInWithPasswordMock);
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
    profileByIdMock.mockResolvedValue({
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
    expect(profileByIdMock).toHaveBeenCalledWith('user-1');
    expect(result.error).toBeNull();
  });

  it('encerra a sessão autenticada quando o perfil interno não existe', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: 'auth-only', email: 'sem-perfil@example.com' } },
      error: null,
    });
    profileByIdMock.mockResolvedValue(null);

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
    profileByIdMock.mockResolvedValue({
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
    profileByIdMock.mockReset();
  });

  it('restaura o perfil ativo associado à sessão Supabase', async () => {
    const profile = { id: 'user-1', email: 'usuario@example.com', ativo: true, role: 'user' };
    getSessionMock.mockResolvedValue({
      data: { session: { user: { id: 'user-1', email: 'usuario@example.com' } } },
    });
    profileByIdMock.mockResolvedValue(profile);

    await expect(restoreSession()).resolves.toBe(profile);
    expect(profileByIdMock).toHaveBeenCalledWith('user-1');
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it.each([
    ['perfil ausente', null],
    ['perfil inativo', { id: 'user-1', email: 'usuario@example.com', ativo: false, role: 'user' }],
  ])('encerra a sessão restaurada quando há %s', async (_scenario, profile) => {
    getSessionMock.mockResolvedValue({
      data: { session: { user: { id: 'user-1', email: 'usuario@example.com' } } },
    });
    profileByIdMock.mockResolvedValue(profile);

    await expect(restoreSession()).resolves.toBeNull();
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  it('não consulta perfil quando não existe sessão', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });

    await expect(restoreSession()).resolves.toBeNull();
    expect(profileByIdMock).not.toHaveBeenCalled();
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

describe('adminDeleteAuthUser', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    vi.unstubAllGlobals();
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: 'token-valido' } },
    });
  });

  it('não chama a Edge Function sem uma sessão administrativa', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(adminDeleteAuthUser('user-1')).resolves.toEqual({
      success: false,
      error: expect.stringContaining('sessão foi encerrada'),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('confirma a exclusão concluída pela Edge Function', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) })
    );

    await expect(adminDeleteAuthUser('user-1')).resolves.toEqual({ success: true });
  });

  it('aciona o fallback do perfil quando a Edge Function não está disponível', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not Found' }),
      })
    );

    const result = await adminDeleteAuthUser('user-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('perfil local');
  });

  it('propaga a falha de limpeza do perfil para o chamador tentar o fallback', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Authentication removed, but profile cleanup failed' }),
      })
    );

    await expect(adminDeleteAuthUser('user-1')).resolves.toEqual({
      success: false,
      error: 'Authentication removed, but profile cleanup failed',
    });
  });
});

describe('mensagens de autenticação', () => {
  it('credencial errada não revela se a conta existe', () => {
    expect(authErrorMessage({ message: 'Invalid login credentials' })).toBe(INVALID_CREDENTIALS);
    expect(INVALID_CREDENTIALS).not.toMatch(/senha incorreta/i);
  });

  it('muitas tentativas e sem conexão', () => {
    expect(authErrorMessage({ status: 429, message: 'x' })).toBe(TOO_MANY_ATTEMPTS);
    expect(authErrorMessage({ message: 'Request rate limit reached' })).toBe(TOO_MANY_ATTEMPTS);
    expect(authErrorMessage({ message: 'Failed to fetch' })).toMatch(/conexão/);
  });

  it('erro de nova senha', () => {
    expect(passwordUpdateErrorMessage({ code: 'same_password' })).toMatch(/diferente/);
    expect(passwordUpdateErrorMessage({ code: 'weak_password' })).toMatch(/fraca/);
  });

  it('login com e-mail errado usa a mensagem genérica', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    });
    await expect(signIn('alguem@example.com', 'x')).resolves.toEqual({
      user: null,
      error: INVALID_CREDENTIALS,
    });
  });
});

describe('sessão encerrada em outro aparelho', () => {
  const payload = {
    user_id: 'user-1',
    email: 'usuario@example.com',
    name: 'Usuário',
    nickname: 'usuario',
    role: 'user',
    ativo: true,
    managed_user_ids: [],
    permissions: {},
    filiais_permitidas: [],
  };

  beforeEach(() => {
    vi.unstubAllGlobals();
    getSessionMock.mockReset();
    refreshSessionMock.mockReset();
    getSessionMock.mockResolvedValue({ data: { session: { access_token: 'token-antigo' } } });
  });

  it('renova a sessão e tenta de novo quando a função responde 401', async () => {
    refreshSessionMock.mockResolvedValue({
      data: { session: { access_token: 'token-novo' } },
      error: null,
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(adminUpdateAuthUser(payload)).resolves.toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer token-novo');
  });

  it('pede para entrar de novo quando a sessão não pode ser renovada', async () => {
    refreshSessionMock.mockResolvedValue({
      data: { session: null },
      error: { message: 'Session not found' },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) })
    );

    const result = await adminUpdateAuthUser(payload);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Entre novamente/);
  });

  it('sair encerra só a sessão deste aparelho', async () => {
    signOutMock.mockReset();
    signOutMock.mockResolvedValue({ error: null });
    await signOut();
    expect(signOutMock).toHaveBeenCalledWith({ scope: 'local' });
  });
});
