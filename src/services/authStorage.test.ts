import { beforeEach, describe, expect, it } from 'vitest';
import {
  authStorage,
  requestSessionFromOpenTabs,
  resetSessionHandoffForTests,
  startBrowserSession,
} from './authStorage';

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

describe('sessão em nova guia', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    resetSessionHandoffForTests();
  });

  it('recebe a sessão de uma guia já aberta do FertCalc', async () => {
    // Simula a guia já logada respondendo pelo mesmo canal.
    const openTab = new BroadcastChannel('fertcalc-auth-session');
    openTab.onmessage = (event) => {
      if (event.data?.type === 'session-request') {
        openTab.postMessage({
          type: 'session-response',
          requestId: event.data.requestId,
          entries: { [AUTH_KEY]: 'token-da-outra-guia', 'outra-chave': 'ignorada' },
        });
      }
    };

    const value = await authStorage.getItem(AUTH_KEY);

    expect(value).toBe('token-da-outra-guia');
    expect(window.sessionStorage.getItem(AUTH_KEY)).toBe('token-da-outra-guia');
    expect(window.sessionStorage.getItem('outra-chave')).toBeNull();
    openTab.close();
  });

  it('segue sem sessão quando nenhuma guia responde', async () => {
    await expect(requestSessionFromOpenTabs(30)).resolves.toBeUndefined();
    expect(window.sessionStorage.getItem(AUTH_KEY)).toBeNull();
    // Depois da tentativa, não pergunta de novo na mesma página.
    expect(authStorage.getItem(AUTH_KEY)).toBeNull();
  });

  it('não importa sessão de outra guia depois de um login nesta guia', () => {
    startBrowserSession();
    expect(authStorage.getItem(AUTH_KEY)).toBeNull();
  });
});
