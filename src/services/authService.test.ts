import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
  },
}));

vi.mock('./db', () => ({
  getUserByEmail: vi.fn(),
}));

vi.mock('../utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { createAuthUser } from './authService';

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
