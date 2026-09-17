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

function clearSupabaseSession(storage: BrowserStorage): void {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
    (key): key is string => Boolean(key?.startsWith('sb-') && key.includes('-auth-token'))
  );

  for (const key of keys) {
    storage.removeItem(key);
  }
}

/** Prepara uma autenticação que existirá somente durante a sessão atual do navegador. */
export function startBrowserSession(): void {
  if (!isBrowser()) return;
  clearSupabaseSession(window.localStorage);
  clearSupabaseSession(window.sessionStorage);
}

/** Storage do Supabase: persiste em recargas, mas é descartado ao fechar o navegador. */
export const authStorage = {
  getItem(key: string): string | null {
    if (!isBrowser()) return null;
    const currentSession = window.sessionStorage.getItem(key);
    if (currentSession) return currentSession;

    // Migra uma sessão antiga que tenha sido salva como "manter conectado".
    const legacySession = window.localStorage.getItem(key);
    if (legacySession) {
      window.sessionStorage.setItem(key, legacySession);
      window.localStorage.removeItem(key);
    }
    return legacySession;
  },
  setItem(key: string, value: string): void {
    if (!isBrowser()) return;
    window.sessionStorage.setItem(key, value);
    window.localStorage.removeItem(key);
  },
  removeItem(key: string): void {
    if (!isBrowser()) return;
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};
