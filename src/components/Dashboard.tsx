import React, { useState, useEffect, useMemo } from 'react';
import { PricingRecord, Goal, User, Branch } from '../types';
import {
  TrendingUp,
  DollarSign,
  FileText,
  Target,
  Clock,
  BarChart3,
  BadgePercent,
  CircleDollarSign,
  CheckCircle2,
  ChartNoAxesCombined,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { getPricingRecords, getGoals, getBranches } from '../services/db';
import { getPricingTotalTons, getPricingTotalSaleValue } from '../utils/pricingMetrics';
import {
  buildCommercialRanking,
  buildFormulaRanking,
  calculatePercentageChange,
  calculatePricingDashboardStats,
  filterPricingsByPeriod,
  getPricingPeriodKey,
  getPreviousPeriod,
  getSixPeriodsEndingAt,
  scopePricingsForUser,
  toPeriodKey,
} from '../utils/pricingDashboard';

interface DashboardProps {
  currentUser: User;
}

export default function Dashboard({ currentUser }: DashboardProps) {
  const [pricings, setPricings] = useState<PricingRecord[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState(() => toPeriodKey(new Date()));

  useEffect(() => {
    const loadData = async () => {
      const [accessiblePricings, userGoals, availableBranches] = await Promise.all([
        getPricingRecords(),
        getGoals(currentUser.id),
        getBranches(),
      ]);
      setPricings(scopePricingsForUser(accessiblePricings, currentUser));
      setGoals(userGoals);
      setBranches(availableBranches);
    };
    loadData();
  }, [currentUser]);

  const filteredPricings = useMemo(
    () => filterPricingsByPeriod(pricings, selectedPeriod),
    [pricings, selectedPeriod]
  );
  const stats = useMemo(() => calculatePricingDashboardStats(filteredPricings), [filteredPricings]);
  const previousStats = useMemo(
    () =>
      calculatePricingDashboardStats(
        filterPricingsByPeriod(pricings, getPreviousPeriod(selectedPeriod))
      ),
    [pricings, selectedPeriod]
  );
  const sellerRanking = useMemo(
    () =>
      buildCommercialRanking(filteredPricings, (pricing) => ({
        id: pricing.userId,
        name: pricing.userName || 'Vendedor não informado',
      })).slice(0, 5),
    [filteredPricings]
  );
  const branchNames = useMemo(
    () => new Map(branches.map((branch) => [branch.id, branch.name])),
    [branches]
  );
  const branchRanking = useMemo(
    () =>
      buildCommercialRanking(filteredPricings, (pricing) => {
        const branchId = pricing.factors?.branchId || 'not-informed';
        return {
          id: branchId,
          name: branchNames.get(branchId) || 'Filial não informada',
        };
      }).slice(0, 5),
    [branchNames, filteredPricings]
  );
  const clientRanking = useMemo(
    () =>
      buildCommercialRanking(filteredPricings, (pricing) => {
        const client = pricing.factors?.client;
        return {
          id: client?.id || client?.name || 'not-informed',
          name: client?.name || 'Cliente não informado',
        };
      }).slice(0, 5),
    [filteredPricings]
  );
  const formulaRanking = useMemo(
    () => buildFormulaRanking(filteredPricings).slice(0, 5),
    [filteredPricings]
  );
  const [selectedYear, selectedMonth] = selectedPeriod.split('-').map(Number);
  const monthlyGoal = goals.find(
    (g) =>
      g.type === 'monthly' &&
      g.month === selectedMonth &&
      g.year === selectedYear &&
      g.status === 'Aprovada'
  );

  const monthlySales = filteredPricings
    .filter((p) => p.status === 'Fechada' && p.approvalStatus === 'Aprovada')
    .reduce((sum, p) => sum + getPricingTotalTons(p), 0);

  const goalProgress = monthlyGoal ? (monthlySales / monthlyGoal.targetValue) * 100 : 0;

  const statusData = [
    {
      name: 'Fechada',
      value: filteredPricings.filter((p) => p.status === 'Fechada').length,
      color: '#10b981',
    },
    { name: 'Em Andamento', value: stats.inProgressCount, color: '#3b82f6' },
    { name: 'Perdida', value: stats.lostCount, color: '#ef4444' },
  ].filter((d) => d.value > 0);

  const availablePeriods = useMemo(() => {
    const periods = new Set([toPeriodKey(new Date())]);
    pricings.forEach((p) => {
      const period = getPricingPeriodKey(p.date);
      if (period) periods.add(period);
    });
    return [...periods].sort().reverse();
  }, [pricings]);

  const last6Months = getSixPeriodsEndingAt(selectedPeriod).map((month) => ({
    ...month,
    value: pricings
      .filter(
        (p) =>
          p.status === 'Fechada' &&
          p.approvalStatus === 'Aprovada' &&
          getPricingPeriodKey(p.date) === month.period
      )
      .reduce((sum, p) => sum + getPricingTotalSaleValue(p), 0),
  }));

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-stone-800">Meu Progresso</h1>
          <p className="text-stone-500">Acompanhe seu desempenho e metas de vendas.</p>
        </div>
        <label className="bg-white px-4 py-2 rounded-xl shadow-sm border border-stone-200 flex items-center gap-2">
          <Clock className="w-4 h-4 text-stone-400" />
          <span className="sr-only">Mês de referência</span>
          <select
            value={selectedPeriod}
            onChange={(event) => setSelectedPeriod(event.target.value)}
            className="bg-transparent text-sm font-bold text-stone-600 uppercase tracking-wider outline-none cursor-pointer"
            aria-label="Mês de referência"
          >
            {availablePeriods.map((period) => {
              const [year, month] = period.split('-').map(Number);
              const label = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
                month: 'long',
                year: 'numeric',
              });
              return (
                <option key={period} value={period}>
                  {label}
                </option>
              );
            })}
          </select>
        </label>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-emerald-100 p-2 rounded-lg">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">
            Vendas Fechadas
          </p>
          <p className="text-2xl font-black text-stone-800">
            R$ {stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <TrendBadge
            value={calculatePercentageChange(stats.totalValue, previousStats.totalValue)}
          />
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <BarChart3 className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">
            Em Negociação
          </p>
          <p className="text-2xl font-black text-stone-800">
            R$ {stats.totalValueInProgress.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-stone-100 p-2 rounded-lg">
              <FileText className="w-5 h-5 text-stone-600" />
            </div>
            <span className="text-xs font-bold text-stone-400">{stats.count} total</span>
          </div>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">
            Precificações
          </p>
          <p className="text-2xl font-black text-stone-800">
            {stats.closedCount} <span className="text-sm font-medium text-stone-400">Sucessos</span>
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-purple-100 p-2 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">
            Volume Fechado
          </p>
          <p className="text-2xl font-black text-stone-800">
            {stats.closedTons.toLocaleString('pt-BR', {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}{' '}
            <span className="text-sm font-medium text-stone-400">t</span>
          </p>
          <TrendBadge
            value={calculatePercentageChange(stats.closedTons, previousStats.closedTons)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
          <div className="bg-amber-100 p-2 rounded-lg w-fit mb-4">
            <CircleDollarSign className="w-5 h-5 text-amber-700" />
          </div>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">
            Ticket Médio
          </p>
          <p className="text-2xl font-black text-stone-800">
            R$ {stats.averageTicketValue.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
          </p>
          <TrendBadge
            value={calculatePercentageChange(
              stats.averageTicketValue,
              previousStats.averageTicketValue
            )}
          />
          <p className="text-xs text-stone-400 mt-1">Por venda fechada e aprovada</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
          <div className="bg-cyan-100 p-2 rounded-lg w-fit mb-4">
            <TrendingUp className="w-5 h-5 text-cyan-700" />
          </div>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">
            Conversão
          </p>
          <p className="text-2xl font-black text-stone-800">
            {stats.conversionRate.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
          </p>
          <TrendBadge
            value={stats.conversionRate - previousStats.conversionRate}
            suffix="p.p."
            hasComparison={previousStats.closedCount + previousStats.lostCount > 0}
          />
          <p className="text-xs text-stone-400 mt-1">Fechadas entre negociações decididas</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
          <div className="bg-emerald-100 p-2 rounded-lg w-fit mb-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-700" />
          </div>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">
            Aprovação
          </p>
          <p className="text-2xl font-black text-stone-800">
            {stats.approvalRate.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
          </p>
          <p className="text-xs text-stone-400 mt-2">Aprovadas entre análises decididas</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
          <div className="bg-violet-100 p-2 rounded-lg w-fit mb-4">
            <BadgePercent className="w-5 h-5 text-violet-700" />
          </div>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">
            Margem Aplicada
          </p>
          <p className="text-2xl font-black text-stone-800">
            R$ {stats.averageMarginPerTon.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
            <span className="text-sm font-medium text-stone-400"> / t</span>
          </p>
          <p className="text-xs text-stone-400 mt-2">Média ponderada pelo volume fechado</p>
        </div>
      </div>

      <section className="bg-stone-900 text-white rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-emerald-500/20 p-2 rounded-xl">
            <ChartNoAxesCombined className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-black">Rentabilidade analisada</h2>
            <p className="text-xs text-stone-400">
              Somente fórmulas vendidas que já possuem análise de rentabilidade salva
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <p className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-1">
              Resultado estimado
            </p>
            <p
              className={`text-2xl font-black ${stats.totalProfitability >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {stats.totalProfitability.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-1">
              Rentabilidade sobre custo
            </p>
            <p className="text-2xl font-black text-white">
              {stats.profitabilityPercent.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">
                Cobertura da análise
              </p>
              <span className="text-sm font-black text-white">
                {stats.profitabilityCoverageRate.toLocaleString('pt-BR', {
                  maximumFractionDigits: 1,
                })}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-stone-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${Math.min(stats.profitabilityCoverageRate, 100)}%` }}
              />
            </div>
            <p className="text-xs text-stone-500 mt-2">
              {stats.analyzedTons.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t de{' '}
              {stats.closedTons.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Goal Progress */}
        <div className="lg:col-span-1 bg-white p-8 rounded-3xl shadow-sm border border-stone-200 flex flex-col">
          <h3 className="text-lg font-black text-stone-800 mb-6 flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-600" />
            Meta Mensal
          </h3>

          {monthlyGoal ? (
            <div className="flex-1 flex flex-col justify-center items-center text-center">
              <div className="relative w-48 h-48 mb-6">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="transparent"
                    className="text-stone-100"
                  />
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="transparent"
                    strokeDasharray={552.9}
                    strokeDashoffset={552.9 - (552.9 * Math.min(goalProgress, 100)) / 100}
                    className="text-emerald-500 transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black text-stone-800">
                    {Math.round(goalProgress)}%
                  </span>
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                    Atingido
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">
                  Volume no Mês
                </p>
                <p className="text-2xl font-black text-emerald-600">
                  {monthlySales.toLocaleString('pt-BR', {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}{' '}
                  t
                </p>
                <p className="text-xs text-stone-500">
                  De uma meta de {monthlyGoal.targetValue.toLocaleString('pt-BR')} toneladas
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
              <Target className="w-12 h-12 text-stone-300 mb-4" />
              <p className="text-stone-500 text-sm">Nenhuma meta aprovada para este mês.</p>
            </div>
          )}
        </div>

        {/* Charts */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-200">
            <h3 className="text-lg font-black text-stone-800 mb-6">Vendas Aprovadas — 6 Meses</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last6Months}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#a8a29e', fontSize: 12, fontWeight: 600 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#a8a29e', fontSize: 10 }}
                    tickFormatter={(value) =>
                      `R$ ${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`
                    }
                  />
                  <Tooltip
                    cursor={{ fill: '#f5f5f4' }}
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Vendas']}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {last6Months.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={index === last6Months.length - 1 ? '#10b981' : '#d6d3d1'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200">
              <h3 className="text-sm font-black text-stone-800 mb-4 uppercase tracking-wider">
                Status das Propostas
              </h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-2">
                {statusData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-[10px] font-bold text-stone-500 uppercase">{d.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-stone-900 p-6 rounded-3xl shadow-xl text-white">
              <h3 className="text-sm font-bold text-stone-400 mb-4 uppercase tracking-wider">
                Últimas Atividades
              </h3>
              <div className="space-y-4">
                {filteredPricings.slice(0, 3).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-start gap-3 pb-3 border-b border-stone-800 last:border-0"
                  >
                    <div
                      className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                        p.status === 'Fechada'
                          ? 'bg-emerald-500'
                          : p.status === 'Perdida'
                            ? 'bg-red-500'
                            : 'bg-blue-500'
                      }`}
                    />
                    <div>
                      <p className="text-xs font-bold">
                        {p.factors?.client?.name || 'Cliente não identificado'}
                      </p>
                      <p className="text-[10px] text-stone-500">
                        #{p.id.slice(0, 8)} • {new Date(p.date).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))}
                {filteredPricings.length === 0 && (
                  <p className="text-xs text-stone-500 italic">Nenhuma atividade neste mês.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {currentUser.role !== 'user' && (
          <RankingCard title="Vendas por vendedor" items={sellerRanking} />
        )}
        <RankingCard title="Vendas por filial" items={branchRanking} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <RankingCard title="Principais clientes" items={clientRanking} />
        <FormulaRankingCard items={formulaRanking} />
      </div>
    </div>
  );
}

function TrendBadge({
  value,
  suffix = '%',
  hasComparison = true,
}: {
  value: number | null;
  suffix?: string;
  hasComparison?: boolean;
}) {
  if (value === null || !hasComparison) {
    return <p className="text-xs text-stone-400 mt-2">Sem base no mês anterior</p>;
  }

  const isPositive = value > 0;
  const isNegative = value < 0;
  return (
    <p
      className={`text-xs font-bold mt-2 ${
        isPositive ? 'text-emerald-600' : isNegative ? 'text-red-600' : 'text-stone-400'
      }`}
    >
      {isPositive ? '▲' : isNegative ? '▼' : '•'} {Math.abs(value).toLocaleString('pt-BR', {
        maximumFractionDigits: 1,
      })}{' '}
      {suffix} vs. mês anterior
    </p>
  );
}

function FormulaRankingCard({ items }: { items: ReturnType<typeof buildFormulaRanking> }) {
  const largestVolume = items[0]?.tons || 0;

  return (
    <section className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200">
      <h3 className="text-sm font-black text-stone-800 mb-5 uppercase tracking-wider">
        Fórmulas por volume
      </h3>
      <div className="space-y-5">
        {items.map((item, index) => (
          <div key={item.id}>
            <div className="flex items-end justify-between gap-4 mb-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-stone-700 truncate">
                  {index + 1}. {item.name}
                </p>
                <p className="text-xs text-stone-400">
                  {item.salesValue.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                    maximumFractionDigits: 0,
                  })}{' '}
                  · {item.salesCount} {item.salesCount === 1 ? 'item' : 'itens'}
                </p>
              </div>
              <p className="text-sm font-black text-stone-800 whitespace-nowrap">
                {item.tons.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t
              </p>
            </div>
            <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-violet-500"
                style={{ width: `${largestVolume > 0 ? (item.tons / largestVolume) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="py-8 text-center text-sm text-stone-400">
            Nenhuma fórmula vendida neste mês.
          </p>
        )}
      </div>
    </section>
  );
}

function RankingCard({
  title,
  items,
}: {
  title: string;
  items: ReturnType<typeof buildCommercialRanking>;
}) {
  const largestValue = items[0]?.salesValue || 0;

  return (
    <section className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200">
      <h3 className="text-sm font-black text-stone-800 mb-5 uppercase tracking-wider">{title}</h3>
      <div className="space-y-5">
        {items.map((item, index) => (
          <div key={item.id}>
            <div className="flex items-end justify-between gap-4 mb-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-stone-700 truncate">
                  {index + 1}. {item.name}
                </p>
                <p className="text-xs text-stone-400">
                  {item.tons.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t ·{' '}
                  {item.salesCount} {item.salesCount === 1 ? 'venda' : 'vendas'}
                </p>
              </div>
              <p className="text-sm font-black text-stone-800 whitespace-nowrap">
                {item.salesValue.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
            <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${largestValue > 0 ? (item.salesValue / largestValue) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="py-8 text-center text-sm text-stone-400">
            Nenhuma venda fechada e aprovada neste mês.
          </p>
        )}
      </div>
    </section>
  );
}
