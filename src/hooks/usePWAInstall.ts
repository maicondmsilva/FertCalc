import { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => void;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Gerencia o prompt de instalação PWA do navegador.
 *
 * Retorna:
 * - `canInstall`  — true quando o browser disparou beforeinstallprompt
 * - `handleInstall` — exibe o prompt nativo e registra a escolha
 */
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    logger.log(
      `[usePWAInstall] Usuário ${outcome === 'accepted' ? 'aceitou' : 'recusou'} a instalação.`
    );
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  return { canInstall: !!deferredPrompt, handleInstall };
}
