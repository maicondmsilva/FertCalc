import React, { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, Target } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PricingRecord } from '../../types';
import {
  formatCompactBRL,
  parsePricingDate,
  type CommercialRankingItem,
  type GoalProgress,
  type StatusBreakdownItem,
} from '../../utils/pricingDashboard';
import { getPricingTotalSaleValue, getPricingTotalTons } from '../../utils/pricingMetrics';

export const brl = (value: number, digits = 2) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
export const tons = (value: number) =>
  `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t`;
const percent = (value: number) =>
  `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

export const card = 'rounded-2xl border border-stone-200 bg-white shadow-sm';

/** Variação contra o mês anterior. */
export function TrendPill({
  value,
  suffix = '%',
  partial = false,
}: {
  value: number | null;
  suffix?: string;
  partial?: boolean;
}) {
  if (value === null)
    return <span className="text-xs text-stone-400">Sem base no mês anterior</span>;
  const up = value > 0.05;
  const down = value < -0.05;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  const tone = up
    ? 'bg-emerald-50 text-emerald-700'
    : down
      ? 'bg-red-50 text-red-700'
      : 'bg-stone-100 text-stone-500';
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
      <span
        className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-bold ${tone}`}
      >
        <Icon className="h-3.5 w-3.5" />
        {Math.abs(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} {suffix}
      </span>
      <span className="text-stone-400">vs. mês anterior{partial ? ' (parcial)' : ''}</span>
    </span>
  );
}

export function KpiCard({
  icon: Icon,
  tone,
  label,
  value,
  detail,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className={`${card} flex flex-col gap-2 p-5`}>
      <div className="flex items-center gap-2.5">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${tone}`}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <h2 className="text-xs font-bold uppercase tracking-wide text-stone-500">{label}</h2>
      </div>
      <p className="break-words text-2xl font-black tabular-nums text-stone-900">{value}</p>
      {detail && <p className="text-xs text-stone-500">{detail}</p>}
      {children}
    </section>
  );
}

/** Indicadores secundários numa faixa compacta. */
export function MetricStrip({
  items,
}: {
  items: { label: string; value: React.ReactNode; hint: string; trend?: React.ReactNode }[];
}) {
  return (
    <section
      className={`${card} grid grid-cols-2 divide-stone-100 lg:grid-cols-4 lg:divide-x`}
      aria-label="Outros indicadores"
    >
      {items.map((item) => (
        <div key={item.label} className="space-y-1 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-500">{item.label}</p>
          <p className="text-lg font-black tabular-nums text-stone-900">{item.value}</p>
          <p className="text-xs text-stone-400">{item.hint}</p>
          {item.trend}
        </div>
      ))}
    </section>
  );
}

export function GoalCard({ progress }: { progress: GoalProgress | null }) {
  return (
    <section className={`${card} flex flex-col p-5`}>
      <h2 className="mb-4 flex items-center gap-2 text-base font-black text-stone-900">
        <Target className="h-5 w-5 text-emerald-600" /> Sua meta do mês
      </h2>
      {progress ? (
        <div className="flex flex-1 flex-col justify-center gap-4">
          <div className="flex items-end justify-between gap-2">
            <p className="text-4xl font-black tabular-nums text-stone-900">
              {progress.percent === null ? '—' : `${Math.round(progress.percent)}%`}
            </p>
            <p className="text-right text-sm text-stone-500">
              <span className="font-bold text-emerald-700">{tons(progress.achievedTons)}</span>
              <br />
              de {tons(Number(progress.goal.targetValue) || 0)}
            </p>
          </div>
          <div
            className="h-3 overflow-hidden rounded-full bg-stone-100"
            role="progressbar"
            aria-label="Meta atingida"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(Math.min(progress.percent ?? 0, 100))}
          >
            <div
              className={`h-full rounded-full transition-all ${
                (progress.percent ?? 0) >= 100 ? 'bg-emerald-500' : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.min(progress.percent ?? 0, 100)}%` }}
            />
          </div>
          <p className="text-xs text-stone-500">
            {progress.percent === null
              ? 'A meta está com valor zero.'
              : progress.percent >= 100
                ? 'Meta atingida. 🎉'
                : `Faltam ${tons(Math.max(0, (Number(progress.goal.targetValue) || 0) - progress.achievedTons))} — só vendas suas, fechadas e aprovadas.`}
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-stone-200 bg-stone-50 p-6 text-center">
          <Target className="mb-2 h-9 w-9 text-stone-300" />
          <p className="text-sm text-stone-500">Nenhuma meta aprovada para este mês.</p>
        </div>
      )}
    </section>
  );
}

export type DashboardMetric = 'value' | 'tons';

/** Alterna entre valor (R$) e volume (t). */
export function MetricToggle({
  value,
  onChange,
  label,
}: {
  value: DashboardMetric;
  onChange: (metric: DashboardMetric) => void;
  label: string;
}) {
  return (
    <div className="inline-flex rounded-lg bg-stone-100 p-0.5" role="radiogroup" aria-label={label}>
      {(
        [
          ['value', 'R$'],
          ['tons', 't'],
        ] as const
      ).map(([metric, text]) => (
        <button
          key={metric}
          type="button"
          role="radio"
          aria-checked={value === metric}
          onClick={() => onChange(metric)}
          className={`min-w-9 rounded-md px-2.5 py-1 text-xs font-black transition ${
            value === metric
              ? 'bg-white text-stone-900 shadow-sm'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

const compactTons = (value: number) =>
  `${value.toLocaleString('pt-BR', { maximumFractionDigits: value >= 100 ? 0 : 1 })} t`;

export function SalesTrendChart({
  data,
}: {
  data: { period: string; month: string; year: number; value: number; tons: number }[];
}) {
  const [metric, setMetric] = useState<DashboardMetric>('value');
  const totalValue = data.reduce((sum, item) => sum + item.value, 0);
  const totalTons = data.reduce((sum, item) => sum + item.tons, 0);
  return (
    <section className={`${card} p-5`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-black text-stone-900">Vendas aprovadas — 6 meses</h2>
          <p className="text-xs text-stone-500">
            Total {formatCompactBRL(totalValue)} · {tons(totalTons)}
          </p>
        </div>
        <MetricToggle value={metric} onChange={setMetric} label="Mostrar vendas em" />
      </div>
      <div className="h-60" role="img" aria-label="Vendas aprovadas por mês nos últimos 6 meses">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#78716c', fontSize: 12, fontWeight: 600 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={64}
              tick={{ fill: '#a8a29e', fontSize: 11 }}
              tickFormatter={(value: number) =>
                metric === 'tons' ? compactTons(value) : formatCompactBRL(value).replace('R$ ', '')
              }
            />
            <Tooltip
              cursor={{ fill: '#f5f5f4' }}
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #e7e5e4',
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.08)',
              }}
              formatter={(
                _value: number,
                _name: string,
                item: { payload?: { value: number; tons: number } }
              ) => [
                `${brl(item.payload?.value ?? 0)} · ${tons(item.payload?.tons ?? 0)}`,
                'Vendas',
              ]}
              labelFormatter={(_, payload) => {
                const item = payload?.[0]?.payload as { month: string; year: number } | undefined;
                return item ? `${item.month} ${item.year}` : '';
              }}
            />
            <Bar dataKey={metric} radius={[6, 6, 0, 0]} isAnimationActive={false}>
              {data.map((entry, index) => (
                <Cell
                  key={entry.period}
                  fill={
                    index === data.length - 1
                      ? metric === 'tons'
                        ? '#8b5cf6'
                        : '#10b981'
                      : '#d6d3d1'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

const STATUS_COLOR: Record<StatusBreakdownItem['key'], string> = {
  approved: 'bg-emerald-500',
  awaitingApproval: 'bg-amber-400',
  inProgress: 'bg-blue-500',
  lost: 'bg-red-500',
};

export function StatusBreakdownCard({ items }: { items: StatusBreakdownItem[] }) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  return (
    <section className={`${card} p-5`}>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-base font-black text-stone-900">Situação das propostas</h2>
        <span className="text-xs text-stone-500">
          {total} {total === 1 ? 'proposta' : 'propostas'} ·{' '}
          {tons(items.reduce((sum, item) => sum + item.tons, 0))}
        </span>
      </div>
      {total > 0 ? (
        <>
          <div
            className="mb-4 flex h-3 overflow-hidden rounded-full bg-stone-100"
            aria-hidden="true"
          >
            {items
              .filter((item) => item.count > 0)
              .map((item) => (
                <div
                  key={item.key}
                  className={STATUS_COLOR[item.key]}
                  style={{ width: `${(item.count / total) * 100}%` }}
                />
              ))}
          </div>
          <ul className="space-y-2.5">
            {items.map((item) => (
              <li key={item.key} className="flex items-center gap-2.5 text-sm">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_COLOR[item.key]}`} />
                <span className="min-w-0 flex-1 truncate text-stone-700">{item.label}</span>
                <span className="font-black tabular-nums text-stone-900">{item.count}</span>
                <span className="w-16 text-right text-xs font-bold tabular-nums text-stone-700">
                  {compactTons(item.tons)}
                </span>
                <span className="w-20 text-right text-xs tabular-nums text-stone-500">
                  {formatCompactBRL(item.value)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="py-8 text-center text-sm text-stone-400">Nenhuma proposta neste mês.</p>
      )}
    </section>
  );
}

export function ProfitabilityPanel({
  totalProfitability,
  profitabilityPercent,
  coverageRate,
  analyzedTons,
  closedTons,
}: {
  totalProfitability: number;
  profitabilityPercent: number;
  coverageRate: number;
  analyzedTons: number;
  closedTons: number;
}) {
  const hasAnalysis = analyzedTons > 0;
  return (
    <section className="rounded-2xl bg-stone-900 p-5 text-white shadow-lg">
      <h2 className="text-base font-black">Rentabilidade analisada</h2>
      <p className="mb-4 text-xs text-stone-400">
        Vendas fechadas e aprovadas com análise de rentabilidade gravada · valores em reais
      </p>
      {hasAnalysis ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Resultado</p>
            <p
              className={`text-2xl font-black tabular-nums ${totalProfitability >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {brl(totalProfitability)}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-stone-400">
              Sobre o custo
            </p>
            <p className="text-2xl font-black tabular-nums">{percent(profitabilityPercent)}</p>
          </div>
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Cobertura</p>
              <span className="text-sm font-black">{percent(coverageRate)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-stone-700">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${Math.min(coverageRate, 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-stone-400">
              {tons(analyzedTons)} de {tons(closedTons)}
            </p>
          </div>
        </div>
      ) : (
        <p className="rounded-xl bg-white/5 px-4 py-6 text-center text-sm text-stone-300">
          Nenhuma venda deste mês tem análise de rentabilidade gravada.
        </p>
      )}
    </section>
  );
}

type RankingTab = {
  key: string;
  label: string;
  items: CommercialRankingItem[];
  /** Fórmulas começam por volume; as demais por valor. */
  byVolume?: boolean;
};

const RANKING_SIZE = 5;

/** Rankings em abas (vendedores, filiais, clientes, fórmulas), por valor ou toneladas. */
export function RankingTabs({ tabs }: { tabs: RankingTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const current = tabs.find((tab) => tab.key === active) || tabs[0];
  const [metricByTab, setMetricByTab] = useState<Record<string, DashboardMetric>>({});
  if (!current) return null;
  const metricKey: DashboardMetric =
    metricByTab[current.key] ?? (current.byVolume ? 'tons' : 'value');
  const measure = (item: CommercialRankingItem) =>
    metricKey === 'tons' ? item.tons : item.salesValue;
  const items = [...current.items]
    .sort((left, right) => measure(right) - measure(left))
    .slice(0, RANKING_SIZE);
  const largest = Math.max(0, ...items.map(measure));
  return (
    <section className={`${card} p-5`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-black text-stone-900">Ranking do mês</h2>
          <MetricToggle
            value={metricKey}
            onChange={(metric) =>
              setMetricByTab((currentMetrics) => ({ ...currentMetrics, [current.key]: metric }))
            }
            label="Ordenar ranking por"
          />
        </div>
        <div
          className="-mx-1 flex max-w-full gap-1 overflow-x-auto rounded-xl bg-stone-100 p-1"
          role="tablist"
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={tab.key === current.key}
              onClick={() => setActive(tab.key)}
              className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                tab.key === current.key
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {items.length > 0 ? (
        <ol className="space-y-4" role="tabpanel">
          {items.map((item, index) => (
            <li key={item.id}>
              <div className="mb-1.5 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-stone-800">
                    <span className="mr-1.5 text-stone-400">{index + 1}.</span>
                    {item.name}
                  </p>
                  <p className="text-xs text-stone-500">
                    {metricKey === 'tons' ? brl(item.salesValue, 0) : tons(item.tons)} ·{' '}
                    {item.salesCount} {item.salesCount === 1 ? 'venda' : 'vendas'}
                  </p>
                </div>
                <p className="whitespace-nowrap text-sm font-black tabular-nums text-stone-900">
                  {metricKey === 'tons' ? tons(item.tons) : brl(item.salesValue, 0)}
                </p>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                <div
                  className={`h-full rounded-full ${metricKey === 'tons' ? 'bg-violet-500' : 'bg-emerald-500'}`}
                  style={{ width: `${largest > 0 ? (measure(item) / largest) * 100 : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="py-8 text-center text-sm text-stone-400">
          Nenhuma venda fechada e aprovada neste mês.
        </p>
      )}
    </section>
  );
}

const STATUS_PILL: Record<string, string> = {
  Fechada: 'bg-emerald-50 text-emerald-700',
  'Em Andamento': 'bg-blue-50 text-blue-700',
  Perdida: 'bg-red-50 text-red-700',
};

export function RecentActivityCard({ items }: { items: PricingRecord[] }) {
  return (
    <section className={`${card} p-5`}>
      <h2 className="mb-4 text-base font-black text-stone-900">Últimas precificações</h2>
      {items.length > 0 ? (
        <ul className="divide-y divide-stone-100">
          {items.map((item) => {
            const date = parsePricingDate(item.date);
            return (
              <li key={item.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-stone-800">
                    {item.factors?.client?.name || 'Cliente não informado'}
                  </p>
                  <p className="text-xs text-stone-500">
                    #{item.formattedCod || String(item.cod ?? '').padStart(4, '0')}
                    {date ? ` · ${date.toLocaleDateString('pt-BR')}` : ''}
                    {item.userName ? ` · ${item.userName}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      STATUS_PILL[item.status] || 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {item.status}
                  </span>
                  <p className="mt-0.5 text-xs font-bold tabular-nums text-stone-700">
                    {compactTons(getPricingTotalTons(item))} ·{' '}
                    {formatCompactBRL(getPricingTotalSaleValue(item))}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-8 text-center text-sm text-stone-400">Nenhuma precificação neste mês.</p>
      )}
    </section>
  );
}

export function DashboardSkeleton() {
  const block = 'animate-pulse rounded-2xl bg-stone-200/70';
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Carregando painel">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className={`${block} h-36`} />
        ))}
      </div>
      <div className={`${block} h-24`} />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className={`${block} h-72`} />
        <div className={`${block} h-72 lg:col-span-2`} />
      </div>
    </div>
  );
}
