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

const isAuthTokenKey = (key: string | null | undefined): key is string =>
  Boolean(key?.startsWith('sb-') && key.includes('-auth-token'));

function clearSupabaseSession(storage: BrowserStorage): void {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
    isAuthTokenKey
  );

  for (const key of keys) {
    storage.removeItem(key);
  }
}

const SESSION_CHANNEL = 'fertcalc-auth-session';
export const SESSION_HANDOFF_TIMEOUT_MS = 800;

type SessionMessage =
  | { type: 'session-request'; requestId: string }
  | { type: 'session-response'; requestId: string; entries: Record<string, string> };

let sessionHandoffAttempted = false;
let sessionHandoffPromise: Promise<void> | null = null;

function openSessionChannel(): BroadcastChannel | null {
  if (!isBrowser() || typeof BroadcastChannel === 'undefined') return null;
  try {
    return new BroadcastChannel(SESSION_CHANNEL);
  } catch {
    return null;
  }
}

function readSessionEntries(): Record<string, string> {
  const entries: Record<string, string> = {};
  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    if (!isAuthTokenKey(key)) continue;
    const value = window.sessionStorage.getItem(key);
    if (value) entries[key] = value;
  }
  return entries;
}

/**
 * Cada guia logada responde aos pedidos de sessão das guias novas do mesmo site.
 * O canal só alcança guias da mesma origem (mesmo endereço do FertCalc).
 */
function listenForSessionRequests(): void {
  const channel = openSessionChannel();
  if (!channel) return;
  channel.addEventListener('message', (event: MessageEvent<SessionMessage>) => {
    if (event.data?.type !== 'session-request') return;
    const entries = readSessionEntries();
    if (Object.keys(entries).length === 0) return;
    channel.postMessage({
      type: 'session-response',
      requestId: event.data.requestId,
      entries,
    } satisfies SessionMessage);
  });
}

/** Pede a sessão às guias já abertas; termina sem sessão se nenhuma responder a tempo. */
export function requestSessionFromOpenTabs(timeoutMs = SESSION_HANDOFF_TIMEOUT_MS): Promise<void> {
  sessionHandoffAttempted = true;
  if (sessionHandoffPromise) return sessionHandoffPromise;
  const channel = openSessionChannel();
  if (!channel) return Promise.resolve();

  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sessionHandoffPromise = new Promise<void>((resolve) => {
    const finish = () => {
      window.clearTimeout(timer);
      channel.close();
      resolve();
    };
    const timer = window.setTimeout(finish, timeoutMs);
    channel.addEventListener('message', (event: MessageEvent<SessionMessage>) => {
      const message = event.data;
      if (message?.type !== 'session-response' || message.requestId !== requestId) return;
      Object.entries(message.entries || {}).forEach(([key, value]) => {
        if (
          isAuthTokenKey(key) &&
          typeof value === 'string' &&
          !window.sessionStorage.getItem(key)
        ) {
          window.sessionStorage.setItem(key, value);
        }
      });
      finish();
    });
    channel.postMessage({ type: 'session-request', requestId } satisfies SessionMessage);
  });
  return sessionHandoffPromise;
}

/** Apenas para testes: permite repetir o pedido de sessão. */
export function resetSessionHandoffForTests(): void {
  sessionHandoffAttempted = false;
  sessionHandoffPromise = null;
}

if (isBrowser()) listenForSessionRequests();

/** Prepara uma autenticação que existirá somente durante a sessão atual do navegador. */
export function startBrowserSession(): void {
  if (!isBrowser()) return;
  // Login explícito nesta guia: não importa a sessão de outra guia depois disso.
  sessionHandoffAttempted = true;
  clearSupabaseSession(window.localStorage);
  clearSupabaseSession(window.sessionStorage);
}

/** Storage do Supabase: persiste em recargas, mas é descartado ao fechar o navegador. */
export const authStorage = {
  getItem(key: string): string | null | Promise<string | null> {
    if (!isBrowser()) return null;
    const currentSession = window.sessionStorage.getItem(key);
    if (currentSession) return currentSession;

    // Migra uma sessão antiga que tenha sido salva como "manter conectado".
    const legacySession = window.localStorage.getItem(key);
    if (legacySession) {
      window.sessionStorage.setItem(key, legacySession);
      window.localStorage.removeItem(key);
      return legacySession;
    }

    // Guia nova (ex.: "Abrir link em nova guia"): o navegador não copia o
    // sessionStorage, então a sessão é pedida às guias já abertas do FertCalc.
    if (isAuthTokenKey(key) && !sessionHandoffAttempted) {
      return requestSessionFromOpenTabs().then(() => window.sessionStorage.getItem(key));
    }
    return null;
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
