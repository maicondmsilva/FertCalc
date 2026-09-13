import { useEffect } from 'react';
import { logger } from '../utils/logger';

const INACTIVITY_MS = 30 * 60 * 1000;

const WATCHED_EVENTS = [
  'mousedown',
  'mousemove',
  'keypress',
  'scroll',
  'touchstart',
  'click',
] as const;

/**
 * Encerra a sessão após 30 minutos sem interação, inclusive quando o usuário
 * escolheu manter o acesso salvo no dispositivo.
 *
 * @param isActive  `true` quando há usuário logado — hook fica inativo caso contrário.
 * @param onTimeout Callback chamado quando o timeout dispara (deve chamar logout).
 */
export function useInactivityTimer(isActive: boolean, onTimeout: () => void) {
  useEffect(() => {
    if (!isActive) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        logger.log('[useInactivityTimer] Sessão expirada por inatividade.');
        onTimeout();
      }, INACTIVITY_MS);
    };

    WATCHED_EVENTS.forEach((ev) => window.addEventListener(ev, resetTimer));
    resetTimer(); // inicia o timer imediatamente

    return () => {
      WATCHED_EVENTS.forEach((ev) => window.removeEventListener(ev, resetTimer));
      clearTimeout(timeoutId);
    };
  }, [isActive, onTimeout]);
}
