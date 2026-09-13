const REMEMBER_SESSION_KEY = 'fertcalc:remember-session';

interface BrowserStorage {
  readonly length: number;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function shouldRememberSession(): boolean {
  return isBrowser() && window.localStorage.getItem(REMEMBER_SESSION_KEY) === 'true';
}

function activeStorage(): BrowserStorage | undefined {
  if (!isBrowser()) return undefined;
  return shouldRememberSession() ? window.localStorage : window.sessionStorage;
}

function clearSupabaseSession(storage: BrowserStorage): void {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
    (key): key is string => Boolean(key?.startsWith('sb-') && key.includes('-auth-token'))
  );

  for (const key of keys) {
    storage.removeItem(key);
  }
}

/** Define se a próxima sessão ficará apenas nesta execução ou será lembrada no dispositivo. */
export function setSessionPersistence(remember: boolean): void {
  if (!isBrowser()) return;

  if (remember) {
    window.localStorage.setItem(REMEMBER_SESSION_KEY, 'true');
  } else {
    window.localStorage.removeItem(REMEMBER_SESSION_KEY);
  }

  // A tela de login sempre inicia uma nova autenticação. Remover tokens antigos evita
  // restaurar acidentalmente a conta anterior quando uma tentativa falhar.
  clearSupabaseSession(window.localStorage);
  clearSupabaseSession(window.sessionStorage);
}

export function isSessionPersistenceEnabled(): boolean {
  return shouldRememberSession();
}

/** Storage customizado usado pelo Supabase para respeitar a escolha feita no login. */
export const authStorage = {
  getItem(key: string): string | null {
    return activeStorage()?.getItem(key) ?? null;
  },
  setItem(key: string, value: string): void {
    activeStorage()?.setItem(key, value);
  },
  removeItem(key: string): void {
    if (!isBrowser()) return;
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};
