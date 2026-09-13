import { beforeEach, describe, expect, it } from 'vitest';
import { authStorage, isSessionPersistenceEnabled, setSessionPersistence } from './authStorage';

const AUTH_KEY = 'sb-project-auth-token';

describe('authStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('usa sessionStorage por padrão', () => {
    authStorage.setItem(AUTH_KEY, 'session-token');

    expect(sessionStorage.getItem(AUTH_KEY)).toBe('session-token');
    expect(localStorage.getItem(AUTH_KEY)).toBeNull();
    expect(isSessionPersistenceEnabled()).toBe(false);
  });

  it('usa localStorage somente quando o usuário escolhe manter conectado', () => {
    setSessionPersistence(true);
    authStorage.setItem(AUTH_KEY, 'remembered-token');

    expect(localStorage.getItem(AUTH_KEY)).toBe('remembered-token');
    expect(sessionStorage.getItem(AUTH_KEY)).toBeNull();
    expect(isSessionPersistenceEnabled()).toBe(true);
  });

  it('remove tokens antigos antes de iniciar uma nova autenticação', () => {
    localStorage.setItem(AUTH_KEY, 'old-local-token');
    sessionStorage.setItem(AUTH_KEY, 'old-session-token');

    setSessionPersistence(false);

    expect(localStorage.getItem(AUTH_KEY)).toBeNull();
    expect(sessionStorage.getItem(AUTH_KEY)).toBeNull();
  });

  it('remove a sessão dos dois armazenamentos no logout', () => {
    localStorage.setItem(AUTH_KEY, 'local-token');
    sessionStorage.setItem(AUTH_KEY, 'session-token');

    authStorage.removeItem(AUTH_KEY);

    expect(localStorage.getItem(AUTH_KEY)).toBeNull();
    expect(sessionStorage.getItem(AUTH_KEY)).toBeNull();
  });
});
