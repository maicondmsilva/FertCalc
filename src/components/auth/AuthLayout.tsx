import React from 'react';
import { Leaf } from 'lucide-react';

export function BrandMark() {
  return (
    <div className="flex items-center justify-center gap-3">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
        <Leaf className="h-6 w-6" aria-hidden="true" />
      </span>
      <span className="text-2xl font-black tracking-tight text-stone-900">
        FertCalc <span className="text-emerald-600">Pro</span>
      </span>
    </div>
  );
}

/**
 * Moldura das telas de acesso (login, recuperação, primeiro acesso, nova
 * senha): logo e o formulário num cartão centralizado.
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
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-stone-50 px-5 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-emerald-200/50 blur-3xl"
      />
      <div className="relative w-full max-w-[420px]">
        <div className="mb-8">
          <BrandMark />
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xl shadow-stone-900/5 sm:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-black text-stone-900">{title}</h1>
            {subtitle && (
              <p
                className={`mt-1.5 text-[15px] ${tone === 'amber' ? 'text-amber-800' : 'text-stone-500'}`}
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
