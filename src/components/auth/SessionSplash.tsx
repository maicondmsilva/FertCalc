import React from 'react';
import { Loader2 } from 'lucide-react';
import { BrandMark } from './AuthLayout';

/**
 * Tela enquanto o app confere a sessão salva (abrir, recarregar, nova guia).
 * Mesmo visual do login, para não "piscar" a tela de entrar.
 */
export default function SessionSplash() {
  return (
    <main
      role="status"
      aria-label="Carregando"
      className="relative flex min-h-[100dvh] flex-col items-center justify-center gap-6 overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-700 px-5"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-0 h-[26rem] w-[26rem] rounded-full bg-emerald-400/25 blur-3xl"
      />
      <div className="relative">
        <BrandMark />
      </div>
      <p className="relative flex items-center gap-2 text-sm font-semibold text-emerald-100/80">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Carregando…
      </p>
    </main>
  );
}
