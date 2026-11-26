import React from 'react';
import { BarChart3, FlaskConical, Leaf, Truck } from 'lucide-react';

const FEATURES = [
  {
    icon: FlaskConical,
    title: 'Formulação otimizada',
    text: 'Batidas no menor custo, com garantias conferidas.',
  },
  {
    icon: BarChart3,
    title: 'Precificação com aprovação',
    text: 'Preço, margem e rentabilidade em um só lugar.',
  },
  {
    icon: Truck,
    title: 'Carregamento e logística',
    text: 'Pedidos, cotações de frete e entregas acompanhadas.',
  },
];

export function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`grid h-11 w-11 place-items-center rounded-2xl ${
          inverse
            ? 'bg-white/15 text-emerald-100'
            : 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
        }`}
      >
        <Leaf className="h-6 w-6" aria-hidden="true" />
      </span>
      <span
        className={`text-2xl font-black tracking-tight ${inverse ? 'text-white' : 'text-stone-900'}`}
      >
        FertCalc <span className={inverse ? 'text-emerald-300' : 'text-emerald-600'}>Pro</span>
      </span>
    </div>
  );
}

/**
 * Moldura das telas de acesso (login, recuperação, primeiro acesso, nova senha):
 * painel da marca à esquerda no computador e o formulário à direita; no
 * celular, só o formulário com a marca no topo.
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
    <div className="min-h-[100dvh] bg-stone-50 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-lime-300/10 blur-3xl"
        />
        <BrandMark inverse />
        <div className="relative space-y-8">
          <h2 className="max-w-md text-4xl font-black leading-tight">
            Do cálculo da fórmula à entrega, tudo no mesmo lugar.
          </h2>
          <ul className="space-y-5">
            {FEATURES.map(({ icon: Icon, title: featureTitle, text }) => (
              <li key={featureTitle} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10">
                  <Icon className="h-5 w-5 text-emerald-200" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-bold">{featureTitle}</span>
                  <span className="text-sm text-emerald-100/80">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-emerald-200/70">
          © {new Date().getFullYear()} FertCalc Pro · Acesso restrito a usuários autorizados.
        </p>
      </aside>

      <main className="flex min-h-[100dvh] items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 lg:hidden">
            <BrandMark />
          </div>
          <div className="mb-6">
            <h1 className="text-2xl font-black text-stone-900 sm:text-3xl">{title}</h1>
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
      </main>
    </div>
  );
}
