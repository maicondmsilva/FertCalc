import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { Network } from '@capacitor/network';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { supabase } from '../services/supabase';
import { logger } from '../utils/logger';
import { NATIVE_NETWORK_EVENT } from './events';

const navigateToPasswordReset = () => {
  window.history.replaceState({}, '', '/reset-password');
  window.dispatchEvent(new PopStateEvent('popstate'));
};

async function handleAuthDeepLink(event: URLOpenListenerEvent) {
  let url: URL;
  try {
    url = new URL(event.url);
  } catch {
    logger.warn('[nativeRuntime] Deep link inválido recebido.');
    return;
  }

  const isPasswordReset =
    url.protocol === 'fertcalc:' &&
    url.hostname === 'auth' &&
    url.pathname.replace(/\/$/, '') === '/reset-password';
  if (!isPasswordReset) return;

  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  const code = url.searchParams.get('code');
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  } else if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
  }

  navigateToPasswordReset();
}

export async function initializeNativeRuntime(): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) return () => undefined;

  document.documentElement.classList.add('native-app');

  const listeners = await Promise.all([
    App.addListener('appUrlOpen', (event) => {
      void handleAuthDeepLink(event).catch((error) =>
        logger.error('[nativeRuntime] Falha ao processar recuperação de senha:', error)
      );
    }),
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else void App.minimizeApp();
    }),
    Network.addListener('networkStatusChange', (status) => {
      window.dispatchEvent(
        new CustomEvent(NATIVE_NETWORK_EVENT, { detail: { connected: status.connected } })
      );
    }),
    Keyboard.addListener('keyboardWillShow', () =>
      document.documentElement.classList.add('native-keyboard-open')
    ),
    Keyboard.addListener('keyboardWillHide', () =>
      document.documentElement.classList.remove('native-keyboard-open')
    ),
  ]);

  const launchUrl = await App.getLaunchUrl();
  if (launchUrl?.url) {
    await handleAuthDeepLink({ url: launchUrl.url });
  }

  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color: '#059669' });
    await StatusBar.setStyle({ style: Style.Light });
  } catch (error) {
    logger.warn('[nativeRuntime] Não foi possível configurar a barra de status:', error);
  } finally {
    await SplashScreen.hide();
  }

  return () => {
    listeners.forEach((listener) => void listener.remove());
    document.documentElement.classList.remove('native-app', 'native-keyboard-open');
  };
}
