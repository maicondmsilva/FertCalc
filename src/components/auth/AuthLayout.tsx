import React from 'react';
import { Leaf } from 'lucide-react';

export function BrandMark() {
  return (
    <div className="flex items-center justify-center gap-3">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20">
        <Leaf className="h-6 w-6" aria-hidden="true" />
      </span>
      <span className="text-2xl font-black tracking-tight text-white">
        FertCalc <span className="text-emerald-300">Pro</span>
      </span>
    </div>
  );
}

/**
 * Moldura das telas de acesso (login, recuperação, primeiro acesso, nova
 * senha): fundo verde escuro e o formulário num cartão translúcido (vidro).
 */
export default function AuthLayout({
  title,
  subtitle,
  tone = 'emerald',
  children,
}: {
  title: string;
  subtitle?: string;
  tone?: 'emerald' | 'amber';
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-700 px-5 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-0 h-[26rem] w-[26rem] rounded-full bg-emerald-400/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-16 h-[26rem] w-[26rem] rounded-full bg-lime-300/15 blur-3xl"
      />
      <div className="relative w-full max-w-[400px]">
        <div className="mb-8">
          <BrandMark />
        </div>
        <div className="rounded-3xl border border-white/15 bg-white/10 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-black text-white">{title}</h1>
            {subtitle && (
              <p
                className={`mt-1.5 text-[15px] ${tone === 'amber' ? 'text-amber-200' : 'text-emerald-100/80'}`}
              >
                {subtitle}
              </p>
            )}
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
