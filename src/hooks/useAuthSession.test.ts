import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../types';
import { restoreSession, signOut } from '../services/authService';
import { isSupabaseLogoutEvent, useAuthSession } from './useAuthSession';

vi.mock('../services/authService', () => ({
  restoreSession: vi.fn(),
  signOut: vi.fn(),
}));

const currentUser = {
  id: 'user-1',
  idNumeric: 1,
  email: 'user@example.com',
  name: 'Usuário',
  nickname: 'usuario',
  ativo: true,
  role: 'user',
} as User;

beforeEach(() => {
  vi.mocked(restoreSession).mockReset();
  vi.mocked(signOut).mockReset();
  vi.mocked(restoreSession).mockResolvedValue(null);
  vi.mocked(signOut).mockResolvedValue();
});

afterEach(cleanup);

describe('useAuthSession', () => {
  it('restaura o usuário da sessão existente', async () => {
    vi.mocked(restoreSession).mockResolvedValue(currentUser);
    const { result } = renderHook(() => useAuthSession(vi.fn()));

    await waitFor(() => expect(result.current.currentUser).toBe(currentUser));
  });

  it('registra o login e volta para a página inicial', () => {
    const navigateHome = vi.fn();
    const { result } = renderHook(() => useAuthSession(navigateHome));

    act(() => result.current.login(currentUser));
    expect(result.current.currentUser).toBe(currentUser);
    expect(navigateHome).toHaveBeenCalledTimes(1);
  });

  it('encerra a sessão local e remota no logout', () => {
    const navigateHome = vi.fn();
    const { result } = renderHook(() => useAuthSession(navigateHome));
    act(() => result.current.login(currentUser));
    navigateHome.mockClear();

    act(() => result.current.logout());
    expect(result.current.currentUser).toBeNull();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(navigateHome).toHaveBeenCalledTimes(1);
  });

  it('identifica somente a remoção da sessão Supabase em outra aba', () => {
    expect(isSupabaseLogoutEvent({ key: 'sb-project-auth-token', newValue: null })).toBe(true);
    expect(isSupabaseLogoutEvent({ key: 'outro-item', newValue: null })).toBe(false);
    expect(isSupabaseLogoutEvent({ key: 'sb-project-auth-token', newValue: 'sessão' })).toBe(false);
  });
});
