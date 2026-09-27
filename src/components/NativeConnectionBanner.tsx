import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { WifiOff } from 'lucide-react';
import { NATIVE_NETWORK_EVENT } from '../mobile/events';

export default function NativeConnectionBanner() {
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    void Network.getStatus().then((status) => setConnected(status.connected));
    const handleNetworkChange = (event: Event) => {
      const detail = (event as CustomEvent<{ connected: boolean }>).detail;
      setConnected(detail.connected);
    };
    window.addEventListener(NATIVE_NETWORK_EVENT, handleNetworkChange);
    return () => window.removeEventListener(NATIVE_NETWORK_EVENT, handleNetworkChange);
  }, []);

  if (connected) return null;

  return (
    <div
      role="status"
      className="app-safe-top fixed inset-x-0 top-0 z-[10000] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-sm font-bold text-amber-950 shadow-lg"
    >
      <WifiOff className="h-4 w-4" aria-hidden="true" />
      Sem conexão. Não será possível sincronizar nem salvar dados até a internet voltar.
    </div>
  );
}
