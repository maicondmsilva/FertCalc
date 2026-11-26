import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CircleDollarSign,
  Clock,
  DollarSign,
  RefreshCw,
  Scale,
  TrendingUp,
} from 'lucide-react';
import type { User } from '../types';
import {
  buildCommercialRanking,
  buildFormulaRanking,
  buildStatusBreakdown,
  calculateGoalProgress,
  calculatePercentageChange,
  calculatePricingDashboardStats,
  filterPricingsByPeriod,
  getPreviousPeriod,
  getPricingPeriodKey,
  getRecentActivity,
  getSixPeriodsEndingAt,
  isCurrentPeriod,
  toPeriodKey,
} from '../utils/pricingDashboard';
import { getPricingTotalSaleValue, getPricingTotalTons } from '../utils/pricingMetrics';
import { useDashboardData } from './dashboard/useDashboardData';
import {
  DashboardSkeleton,
  GoalCard,
  KpiCard,
  MetricStrip,
  ProfitabilityPanel,
  RankingTabs,
  RecentActivityCard,
  SalesTrendChart,
  StatusBreakdownCard,
  TrendPill,
  brl,
  tons,
} from './dashboard/DashboardWidgets';

interface DashboardProps {
  currentUser: User;
}

const periodLabel = (period: string) => {
  const [year, month] = period.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
};

/**
 * Painel da precificação: indicadores do mês, meta, tendência, situação das
 * propostas, rentabilidade e rankings. Toda a conta fica em utils/pricingDashboard
 * (testada); aqui só a montagem da tela.
 */
export default function Dashboard({ currentUser }: DashboardProps) {
  const { pricings, goals, branches, loading, error, reload } = useDashboardData(currentUser);
  const [selectedPeriod, setSelectedPeriod] = useState(() => toPeriodKey(new Date()));
  const isManagerOrAbove =
    currentUser.role === 'master' || currentUser.role === 'admin' || currentUser.role === 'manager';

  const view = useMemo(() => {
    const monthPricings = filterPricingsByPeriod(pricings, selectedPeriod);
    const stats = calculatePricingDashboardStats(monthPricings);
    const previous = calculatePricingDashboardStats(
      filterPricingsByPeriod(pricings, getPreviousPeriod(selectedPeriod))
    );
    const branchNames = new Map(branches.map((branch) => [branch.id, branch.name]));
    const periods = new Set([toPeriodKey(new Date())]);
    pricings.forEach((pricing) => {
      const period = getPricingPeriodKey(pricing.date);
      if (period) periods.add(period);
    });

    return {
      stats,
      previous,
      periods: [...periods].sort().reverse(),
      goal: calculateGoalProgress(goals, pricings, currentUser.id, selectedPeriod),
      status: buildStatusBreakdown(monthPricings),
      recent: getRecentActivity(monthPricings, 5),
      trend: getSixPeriodsEndingAt(selectedPeriod).map((month) => {
        const approved = filterPricingsByPeriod(pricings, month.period).filter(
          (pricing) => pricing.status === 'Fechada' && pricing.approvalStatus === 'Aprovada'
        );
        return {
          ...month,
          value: approved.reduce((sum, pricing) => sum + getPricingTotalSaleValue(pricing), 0),
          tons: approved.reduce((sum, pricing) => sum + getPricingTotalTons(pricing), 0),
        };
      }),
      rankings: [
        ...(isManagerOrAbove
          ? [
              {
                key: 'sellers',
                label: 'Vendedores',
                items: buildCommercialRanking(monthPricings, (pricing) => ({
                  id: pricing.userId,
                  name: pricing.userName || 'Vendedor não informado',
                })),
              },
            ]
          : []),
        {
          key: 'branches',
          label: 'Filiais',
          items: buildCommercialRanking(monthPricings, (pricing) => {
            const id = pricing.factors?.branchId || 'not-informed';
            return { id, name: branchNames.get(id) || 'Filial não informada' };
          }),
        },
        {
          key: 'clients',
          label: 'Clientes',
          items: buildCommercialRanking(monthPricings, (pricing) => {
            const client = pricing.factors?.client;
            return {
              id: client?.id || client?.name || 'not-informed',
              name: client?.name || 'Cliente não informado',
            };
          }),
        },
        {
          key: 'formulas',
          label: 'Fórmulas',
          byVolume: true,
          items: buildFormulaRanking(monthPricings),
        },
      ],
    };
  }, [pricings, goals, branches, selectedPeriod, currentUser.id, isManagerOrAbove]);

  const { stats, previous } = view;
  const partial = isCurrentPeriod(selectedPeriod);

  return (
    <div className="space-y-5 pb-12">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-stone-900 sm:text-3xl">Meu Progresso</h1>
          <p className="text-sm text-stone-500">
            {isManagerOrAbove
              ? 'Desempenho seu e da sua equipe, metas e rentabilidade.'
              : 'Seu desempenho, metas e rentabilidade.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {partial && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
              Mês em andamento
            </span>
          )}
          <label className="flex h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 shadow-sm">
            <Calendar className="h-4 w-4 text-stone-400" />
            <select
              value={selectedPeriod}
              onChange={(event) => setSelectedPeriod(event.target.value)}
              className="cursor-pointer bg-transparent text-sm font-bold capitalize text-stone-700 outline-none"
              aria-label="Mês de referência"
            >
              {view.periods.map((period) => (
                <option key={period} value={period}>
                  {periodLabel(period)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </span>
          <button
            type="button"
            onClick={reload}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 font-bold text-white hover:bg-red-700"
          >
            <RefreshCw className="h-4 w-4" /> Tentar de novo
          </button>
        </div>
      )}

      {loading ? (
        <DashboardSkeleton />
      ) : (
        !error && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                icon={DollarSign}
                tone="bg-emerald-100 text-emerald-700"
                label="Vendas fechadas"
                value={brl(stats.totalValue)}
                detail={`${stats.closedCount} ${stats.closedCount === 1 ? 'venda aprovada' : 'vendas aprovadas'}`}
              >
                <TrendPill
                  value={calculatePercentageChange(stats.totalValue, previous.totalValue)}
                  partial={partial}
                />
              </KpiCard>
              <KpiCard
                icon={Scale}
                tone="bg-violet-100 text-violet-700"
                label="Volume fechado"
                value={tons(stats.closedTons)}
              >
                <TrendPill
                  value={calculatePercentageChange(stats.closedTons, previous.closedTons)}
                  partial={partial}
                />
              </KpiCard>
              <KpiCard
                icon={Clock}
                tone="bg-blue-100 text-blue-700"
                label="Em negociação"
                value={brl(stats.totalValueInProgress)}
                detail={`${tons(stats.tonsInProgress)} · ${stats.inProgressCount} ${stats.inProgressCount === 1 ? 'proposta' : 'propostas'} em andamento`}
              />
              <KpiCard
                icon={TrendingUp}
                tone="bg-cyan-100 text-cyan-700"
                label="Conversão"
                value={`${stats.conversionRate.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}
                detail="Fechadas entre negociações decididas"
              >
                <TrendPill
                  value={
                    previous.closedCount + previous.lostCount > 0
                      ? stats.conversionRate - previous.conversionRate
                      : null
                  }
                  suffix="p.p."
                  partial={partial}
                />
              </KpiCard>
            </div>

            <MetricStrip
              items={[
                {
                  label: 'Ticket médio',
                  value: brl(stats.averageTicketValue),
                  hint: 'Por venda fechada e aprovada',
                },
                {
                  label: 'Aprovação',
                  value: `${stats.approvalRate.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`,
                  hint: 'Aprovadas entre análises decididas',
                },
                {
                  label: 'Margem aplicada',
                  value: `${brl(stats.averageMarginPerTon)}/t`,
                  hint: 'Média ponderada pelo volume',
                },
                {
                  label: 'Precificações',
                  value: stats.count,
                  hint: 'No mês, sem as excluídas',
                },
              ]}
            />

            <div className="grid gap-5 lg:grid-cols-3">
              <GoalCard progress={view.goal} />
              <div className="lg:col-span-2">
                <SalesTrendChart data={view.trend} />
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <ProfitabilityPanel
                totalProfitability={stats.totalProfitability}
                profitabilityPercent={stats.profitabilityPercent}
                coverageRate={stats.profitabilityCoverageRate}
                analyzedTons={stats.analyzedTons}
                closedTons={stats.closedTons}
              />
              <StatusBreakdownCard items={view.status} />
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <RankingTabs tabs={view.rankings} />
              <RecentActivityCard items={view.recent} />
            </div>

            {stats.count === 0 && (
              <p className="flex items-center justify-center gap-2 text-sm text-stone-400">
                <CircleDollarSign className="h-4 w-4" /> Nenhuma precificação em{' '}
                {periodLabel(selectedPeriod)}.
              </p>
            )}
          </>
        )
      )}
    </div>
  );
}
