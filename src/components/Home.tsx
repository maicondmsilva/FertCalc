import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Beaker,
  Calculator,
  ClipboardList,
  CreditCard,
  FlaskConical,
  Package,
  Settings,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import type { User } from '../types';
import { hasUserPermission } from '../navigation/appNavigation';

type ModuleId = 'pricing' | 'config' | 'managementReports' | 'expenses' | 'carregamento';

interface HomeProps {
  currentUser: User;
  onSelectModule: (moduleId: ModuleId | 'relatorios') => void;
}

interface Shortcut {
  route: string;
  label: string;
  icon: LucideIcon;
  permission: string;
}

interface ModuleCard {
  id: ModuleId;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Classes do ícone (fundo e cor) e do destaque ao passar o mouse. */
  tone: { icon: string; hover: string; link: string };
  allowed: (has: (permission: string) => boolean, user: User) => boolean;
  links: Array<{ route: string; label: string; permission: string }>;
}

const isManagerOrAbove = (user: User) =>
  user.role === 'master' || user.role === 'admin' || user.role === 'manager';

const SHORTCUTS: Shortcut[] = [
  { route: 'calculator', label: 'Calculadora', icon: Calculator, permission: 'calculator' },
  {
    route: 'simplified_calculator',
    label: 'Calculadora Simplificada',
    icon: Calculator,
    permission: 'simplified_calculator',
  },
  {
    route: 'simplified_calculator_beta',
    label: 'Calculadora Teste',
    icon: FlaskConical,
    permission: 'simplified_calculator_beta',
  },
  { route: 'saved_formulas', label: 'Batidas Salvas', icon: Beaker, permission: 'savedFormulas' },
  {
    route: 'produtos_formulados',
    label: 'Produtos Formulados',
    icon: Package,
    permission: 'produtosFormulados',
  },
  { route: 'history', label: 'Precificações', icon: ClipboardList, permission: 'history' },
  { route: 'approvals', label: 'Aprovações', icon: ShieldCheck, permission: 'approvals' },
];

const MODULES: ModuleCard[] = [
  {
    id: 'pricing',
    label: 'Precificação',
    description: 'Calculadoras, batidas, precificações, tabelas de preço, clientes e metas.',
    icon: Calculator,
    tone: {
      icon: 'bg-emerald-600 text-white',
      hover: 'hover:border-emerald-300',
      link: 'text-emerald-700',
    },
    allowed: (has, user) =>
      isManagerOrAbove(user) ||
      ['dashboard', 'calculator', 'simplified_calculator', 'savedFormulas', 'history'].some(has),
    links: [
      { route: 'dashboard', label: 'Dashboard', permission: 'dashboard' },
      { route: 'history', label: 'Precificações', permission: 'history' },
      { route: 'pricelists', label: 'Tabelas de preço', permission: 'priceLists' },
    ],
  },
  {
    id: 'carregamento',
    label: 'Carregamento',
    description: 'Cotação de frete, liberação de pedidos, logística, calendário e relatórios.',
    icon: Truck,
    tone: {
      icon: 'bg-amber-500 text-white',
      hover: 'hover:border-amber-300',
      link: 'text-amber-700',
    },
    allowed: (has, user) =>
      isManagerOrAbove(user) || has('carregamento') || has('carregamento_admin'),
    links: [
      { route: 'carregamento_visao_geral', label: 'Visão geral', permission: 'carregamento' },
      { route: 'carregamento_calendario', label: 'Calendário', permission: 'carregamento' },
    ],
  },
  {
    id: 'expenses',
    label: 'Gastos do cartão',
    description: 'Despesas do cartão corporativo, com conferência, aprovações e relatórios.',
    icon: CreditCard,
    tone: {
      icon: 'bg-violet-600 text-white',
      hover: 'hover:border-violet-300',
      link: 'text-violet-700',
    },
    allowed: (has, user) => isManagerOrAbove(user) || has('expenses'),
    links: [
      { route: 'expenses_lancamentos', label: 'Lançamentos', permission: 'expenses' },
      { route: 'expenses_relatorios', label: 'Relatórios', permission: 'expenses' },
    ],
  },
  {
    id: 'managementReports',
    label: 'Relatório diário',
    description: 'Desempenho consolidado das unidades de negócio.',
    icon: BarChart3,
    tone: {
      icon: 'bg-indigo-600 text-white',
      hover: 'hover:border-indigo-300',
      link: 'text-indigo-700',
    },
    allowed: (has, user) => isManagerOrAbove(user) || has('managementReports'),
    links: [
      {
        route: 'managementReports_dashboard',
        label: 'Painel',
        permission: 'managementReports',
      },
    ],
  },
  {
    id: 'config',
    label: 'Configurações',
    description: 'Usuários, perfis de acesso, filiais e locais e personalização do sistema.',
    icon: Settings,
    tone: {
      icon: 'bg-stone-800 text-white',
      hover: 'hover:border-stone-400',
      link: 'text-stone-700',
    },
    allowed: (has) => has('users') || has('branches') || has('settings'),
    links: [
      { route: 'users', label: 'Usuários', permission: 'users' },
      { route: 'branches', label: 'Filiais e locais', permission: 'branches' },
      { route: 'settings', label: 'Personalização', permission: 'settings' },
    ],
  },
];

/** Data por extenso com só a primeira letra maiúscula: "Quinta-feira, 19 de novembro". */
export function formatToday(date: Date): string {
  const text = date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return text.charAt(0).toLocaleUpperCase('pt-BR') + text.slice(1);
}

/** Saudação conforme o horário local. */
export function getGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function Home({ currentUser, onSelectModule }: HomeProps) {
  const has = (permission: string) => hasUserPermission(currentUser, permission);
  const now = new Date();
  const firstName = (currentUser.name || '').trim().split(/\s+/)[0] || 'bem-vindo';
  const today = formatToday(now);
  const shortcuts = SHORTCUTS.filter((shortcut) => has(shortcut.permission));
  const modules = MODULES.filter((module) => module.allowed(has, currentUser));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 py-6 md:py-10">
      {/* Saudação */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 px-6 py-8 text-white shadow-lg md:px-10 md:py-10">
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-20 right-24 h-48 w-48 rounded-full bg-teal-300/20 blur-2xl"
        />
        <p className="relative text-sm font-semibold text-emerald-100">{today}</p>
        <h1 className="relative mt-1 text-3xl font-black tracking-tight md:text-4xl">
          {getGreeting(now)}, {firstName}
        </h1>
        <p className="relative mt-2 max-w-xl text-[15px] text-emerald-50/90">
          Escolha um atalho ou um módulo para começar.
        </p>

        {shortcuts.length > 0 && (
          <nav aria-label="Atalhos" className="relative mt-6 flex flex-wrap gap-2">
            {shortcuts.map(({ route, label, icon: Icon }) => (
              <Link
                key={route}
                to={`/${route}`}
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3.5 py-2 text-sm font-bold text-white ring-1 ring-white/20 backdrop-blur transition-colors hover:bg-white hover:text-emerald-800"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      {/* Módulos */}
      <section aria-labelledby="modulos-titulo">
        <h2
          id="modulos-titulo"
          className="mb-3 text-xs font-bold uppercase tracking-widest text-stone-500"
        >
          Módulos
        </h2>
        {modules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center text-[15px] text-stone-500">
            Seu usuário ainda não tem módulos liberados. Fale com o administrador.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((module) => {
              const Icon = module.icon;
              const links = module.links.filter((link) => has(link.permission));
              return (
                <article
                  key={module.id}
                  className={`group flex flex-col rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${module.tone.hover}`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectModule(module.id)}
                    className="flex flex-1 flex-col items-start text-left"
                  >
                    <span
                      className={`grid h-12 w-12 place-items-center rounded-xl shadow-sm ${module.tone.icon}`}
                    >
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <span className="mt-4 text-lg font-black text-stone-900">{module.label}</span>
                    <span className="mt-1 text-[15px] leading-relaxed text-stone-500">
                      {module.description}
                    </span>
                    <span
                      className={`mt-4 inline-flex items-center gap-1.5 text-sm font-bold ${module.tone.link}`}
                    >
                      Abrir módulo
                      <ArrowRight
                        className="h-4 w-4 transition-transform group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </span>
                  </button>
                  {links.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5 border-t border-stone-100 pt-3">
                      {links.map((link) => (
                        <Link
                          key={link.route}
                          to={`/${link.route}`}
                          className="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600 transition-colors hover:bg-stone-200 hover:text-stone-900"
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
