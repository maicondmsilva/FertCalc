import { beforeEach, describe, expect, it } from 'vitest';
import { authStorage, startBrowserSession } from './authStorage';

const AUTH_KEY = 'sb-project-auth-token';

describe('authStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('usa sessionStorage por padrão', () => {
    authStorage.setItem(AUTH_KEY, 'session-token');

    expect(window.sessionStorage.getItem(AUTH_KEY)).toBe('session-token');
    expect(window.localStorage.getItem(AUTH_KEY)).toBeNull();
  });

  it('migra uma sessão antiga para a sessão atual do navegador', () => {
    window.localStorage.setItem(AUTH_KEY, 'remembered-token');

    expect(authStorage.getItem(AUTH_KEY)).toBe('remembered-token');
    expect(window.localStorage.getItem(AUTH_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(AUTH_KEY)).toBe('remembered-token');
  });

  it('remove tokens antigos antes de iniciar uma nova autenticação', () => {
    window.localStorage.setItem(AUTH_KEY, 'old-local-token');
    window.sessionStorage.setItem(AUTH_KEY, 'old-session-token');

    startBrowserSession();

    expect(window.localStorage.getItem(AUTH_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(AUTH_KEY)).toBeNull();
  });

  it('remove a sessão dos dois armazenamentos no logout', () => {
    window.localStorage.setItem(AUTH_KEY, 'local-token');
    window.sessionStorage.setItem(AUTH_KEY, 'session-token');

    authStorage.removeItem(AUTH_KEY);

    expect(window.localStorage.getItem(AUTH_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(AUTH_KEY)).toBeNull();
  });
});
