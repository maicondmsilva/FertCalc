import type { Goal, PricingRecord, ProfitabilityAnalysis, User } from '../types';
import {
  getPricingTotalSaleValue,
  getPricingTotalTons,
  getPricingWeightedMargin,
} from './pricingMetrics';
import { convertPricingMoneyToBRL } from './pricingCurrency';

export interface PricingDashboardStats {
  totalValue: number;
  totalValueInProgress: number;
  tonsInProgress: number;
  count: number;
  closedCount: number;
  inProgressCount: number;
  lostCount: number;
  closedTons: number;
  averageTicketValue: number;
  conversionRate: number;
  approvalRate: number;
  averageMarginPerTon: number;
  analyzedTons: number;
  profitabilityCoverageRate: number;
  totalProfitability: number;
  profitabilityPercent: number;
}

export function toPeriodKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getPricingPeriodKey(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.slice(0, 7);

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : toPeriodKey(date);
}

export function filterPricingsByPeriod(pricings: PricingRecord[], period: string): PricingRecord[] {
  return pricings.filter((pricing) => getPricingPeriodKey(pricing.date) === period);
}

export function getPreviousPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number);
  return toPeriodKey(new Date(year, month - 2, 1));
}

export function calculatePercentageChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function calculatePricingDashboardStats(pricings: PricingRecord[]): PricingDashboardStats {
  const approvedClosed = pricings.filter(
    (pricing) => pricing.status === 'Fechada' && pricing.approvalStatus === 'Aprovada'
  );
  const inProgress = pricings.filter((pricing) => pricing.status === 'Em Andamento');
  const lostCount = pricings.filter((pricing) => pricing.status === 'Perdida').length;
  const decidedNegotiations = approvedClosed.length + lostCount;
  const approvalDecisions = pricings.filter(
    (pricing) =>
      pricing.status !== 'Excluída' &&
      (pricing.approvalStatus === 'Aprovada' || pricing.approvalStatus === 'Reprovada')
  );
  const approvedDecisions = approvalDecisions.filter(
    (pricing) => pricing.approvalStatus === 'Aprovada'
  ).length;
  const totalValue = approvedClosed.reduce(
    (sum, pricing) => sum + getPricingTotalSaleValue(pricing),
    0
  );
  const marginTotals = approvedClosed.reduce(
    (acc, pricing) => {
      const margin = getPricingWeightedMargin(pricing);
      return {
        value: acc.value + margin.marginPerTon * margin.tons,
        tons: acc.tons + margin.tons,
      };
    },
    { value: 0, tons: 0 }
  );
  const profitabilityTotals = approvedClosed.reduce(
    (acc, pricing) => {
      (pricing.calculations || []).forEach((calculation) => {
        const analysis = calculation.profitabilityAnalysis;
        if (!analysis) return;
        const tons = Number(calculation.factors?.totalTons) || 0;
        const brl = profitabilityAnalysisInBRL(analysis);
        acc.tons += tons;
        acc.profitability += brl.profitability * tons;
        acc.baseCost += brl.baseCostAfterFactor * tons;
      });
      return acc;
    },
    { tons: 0, profitability: 0, baseCost: 0 }
  );
  const closedTons = approvedClosed.reduce((sum, pricing) => sum + getPricingTotalTons(pricing), 0);

  return {
    totalValue,
    totalValueInProgress: inProgress.reduce(
      (sum, pricing) => sum + getPricingTotalSaleValue(pricing),
      0
    ),
    tonsInProgress: inProgress.reduce((sum, pricing) => sum + getPricingTotalTons(pricing), 0),
    count: pricings.length,
    closedCount: approvedClosed.length,
    inProgressCount: inProgress.length,
    lostCount,
    closedTons,
    averageTicketValue: approvedClosed.length > 0 ? totalValue / approvedClosed.length : 0,
    conversionRate:
      decidedNegotiations > 0 ? (approvedClosed.length / decidedNegotiations) * 100 : 0,
    approvalRate:
      approvalDecisions.length > 0 ? (approvedDecisions / approvalDecisions.length) * 100 : 0,
    averageMarginPerTon: marginTotals.tons > 0 ? marginTotals.value / marginTotals.tons : 0,
    analyzedTons: profitabilityTotals.tons,
    profitabilityCoverageRate: closedTons > 0 ? (profitabilityTotals.tons / closedTons) * 100 : 0,
    totalProfitability: profitabilityTotals.profitability,
    profitabilityPercent:
      profitabilityTotals.baseCost > 0
        ? (profitabilityTotals.profitability / profitabilityTotals.baseCost) * 100
        : 0,
  };
}

export interface CommercialRankingItem {
  id: string;
  name: string;
  salesValue: number;
  tons: number;
  salesCount: number;
}

export function scopePricingsForUser(
  pricings: PricingRecord[],
  currentUser: User
): PricingRecord[] {
  if (currentUser.role === 'master' || currentUser.role === 'admin') return pricings;

  const visibleUserIds = new Set([
    currentUser.id,
    ...(currentUser.role === 'manager' ? currentUser.managedUserIds || [] : []),
  ]);
  return pricings.filter((pricing) => visibleUserIds.has(pricing.userId));
}

export function buildCommercialRanking(
  pricings: PricingRecord[],
  getGroup: (pricing: PricingRecord) => { id: string; name: string }
): CommercialRankingItem[] {
  const groups = new Map<string, CommercialRankingItem>();

  pricings
    .filter((pricing) => pricing.status === 'Fechada' && pricing.approvalStatus === 'Aprovada')
    .forEach((pricing) => {
      const group = getGroup(pricing);
      const current = groups.get(group.id) || {
        ...group,
        salesValue: 0,
        tons: 0,
        salesCount: 0,
      };
      current.salesValue += getPricingTotalSaleValue(pricing);
      current.tons += getPricingTotalTons(pricing);
      current.salesCount += 1;
      groups.set(group.id, current);
    });

  return [...groups.values()].sort(
    (left, right) => right.salesValue - left.salesValue || left.name.localeCompare(right.name)
  );
}

export function buildFormulaRanking(pricings: PricingRecord[]): CommercialRankingItem[] {
  const groups = new Map<string, CommercialRankingItem>();

  pricings
    .filter((pricing) => pricing.status === 'Fechada' && pricing.approvalStatus === 'Aprovada')
    .forEach((pricing) => {
      const calculations =
        pricing.calculations && pricing.calculations.length > 0
          ? pricing.calculations.map((calculation) => ({
              id: calculation.formula || 'not-informed',
              name: calculation.formula || 'Fórmula não informada',
              tons: Number(calculation.factors?.totalTons) || 0,
              salesValue: Number(calculation.summary?.totalSaleValue) || 0,
            }))
          : [
              {
                id: pricing.factors?.targetFormula || 'not-informed',
                name: pricing.factors?.targetFormula || 'Fórmula não informada',
                tons: getPricingTotalTons(pricing),
                salesValue: getPricingTotalSaleValue(pricing),
              },
            ];

      calculations.forEach((calculation) => {
        const current = groups.get(calculation.id) || {
          id: calculation.id,
          name: calculation.name,
          salesValue: 0,
          tons: 0,
          salesCount: 0,
        };
        current.salesValue += calculation.salesValue;
        current.tons += calculation.tons;
        current.salesCount += 1;
        groups.set(calculation.id, current);
      });
    });

  return [...groups.values()].sort(
    (left, right) => right.tons - left.tons || right.salesValue - left.salesValue
  );
}

export function getSixPeriodsEndingAt(period: string) {
  const [year, month] = period.split('-').map(Number);

  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(year, month - 1 - (5 - index), 1);
    return {
      period: toPeriodKey(date),
      month: date.toLocaleString('pt-BR', { month: 'short' }),
      year: date.getFullYear(),
    };
  });
}

/**
 * Valores da análise de rentabilidade em reais. Análises em dólar guardam o
 * resultado em US$; somar com as em reais distorcia o painel.
 */
export function profitabilityAnalysisInBRL(
  analysis: Pick<
    ProfitabilityAnalysis,
    'profitability' | 'baseCostAfterFactor' | 'currency' | 'exchangeRate' | 'profitabilityBRL'
  >
): { profitability: number; baseCostAfterFactor: number } {
  const currency = analysis.currency || 'BRL';
  const storedBRL = Number(analysis.profitabilityBRL);
  return {
    profitability:
      currency === 'USD' && Number.isFinite(storedBRL) && analysis.profitabilityBRL !== undefined
        ? storedBRL
        : convertPricingMoneyToBRL(
            Number(analysis.profitability) || 0,
            currency,
            analysis.exchangeRate
          ),
    baseCostAfterFactor: convertPricingMoneyToBRL(
      Number(analysis.baseCostAfterFactor) || 0,
      currency,
      analysis.exchangeRate
    ),
  };
}

/** Precificações excluídas não entram em nenhum número do painel. */
export const withoutDeleted = (pricings: PricingRecord[]) =>
  pricings.filter((pricing) => pricing.status !== 'Excluída');

export interface StatusBreakdownItem {
  key: 'approved' | 'awaitingApproval' | 'inProgress' | 'lost';
  label: string;
  count: number;
  value: number;
  tons: number;
}

/**
 * Situação das propostas do mês. "Fechada" aprovada e "Fechada" aguardando
 * aprovação ficam separadas, igual aos indicadores (antes o gráfico juntava as
 * duas e não batia com o total de vendas fechadas).
 */
export function buildStatusBreakdown(pricings: PricingRecord[]): StatusBreakdownItem[] {
  const groups: Record<StatusBreakdownItem['key'], StatusBreakdownItem> = {
    approved: { key: 'approved', label: 'Fechadas e aprovadas', count: 0, value: 0, tons: 0 },
    awaitingApproval: {
      key: 'awaitingApproval',
      label: 'Fechadas aguardando aprovação',
      count: 0,
      value: 0,
      tons: 0,
    },
    inProgress: { key: 'inProgress', label: 'Em andamento', count: 0, value: 0, tons: 0 },
    lost: { key: 'lost', label: 'Perdidas', count: 0, value: 0, tons: 0 },
  };
  withoutDeleted(pricings).forEach((pricing) => {
    const key: StatusBreakdownItem['key'] | null =
      pricing.status === 'Fechada'
        ? pricing.approvalStatus === 'Aprovada'
          ? 'approved'
          : 'awaitingApproval'
        : pricing.status === 'Em Andamento'
          ? 'inProgress'
          : pricing.status === 'Perdida'
            ? 'lost'
            : null;
    if (!key) return;
    groups[key].count += 1;
    groups[key].value += getPricingTotalSaleValue(pricing);
    groups[key].tons += getPricingTotalTons(pricing);
  });
  return Object.values(groups);
}

export interface GoalProgress {
  goal: Goal;
  /** Toneladas fechadas e aprovadas do próprio usuário no mês. */
  achievedTons: number;
  /** null quando a meta é zero (evita divisão por zero). */
  percent: number | null;
}

/**
 * Meta mensal aprovada do usuário contra as vendas DELE (antes, para gestor e
 * admin, somava as vendas da equipe ou da empresa contra a meta pessoal).
 */
export function calculateGoalProgress(
  goals: Goal[],
  pricings: PricingRecord[],
  userId: string,
  period: string
): GoalProgress | null {
  const [year, month] = period.split('-').map(Number);
  const goal = goals.find(
    (item) =>
      item.userId === userId &&
      item.type === 'monthly' &&
      item.month === month &&
      item.year === year &&
      item.status === 'Aprovada'
  );
  if (!goal) return null;
  const achievedTons = filterPricingsByPeriod(withoutDeleted(pricings), period)
    .filter(
      (pricing) =>
        pricing.userId === userId &&
        pricing.status === 'Fechada' &&
        pricing.approvalStatus === 'Aprovada'
    )
    .reduce((sum, pricing) => sum + getPricingTotalTons(pricing), 0);
  const target = Number(goal.targetValue) || 0;
  return { goal, achievedTons, percent: target > 0 ? (achievedTons / target) * 100 : null };
}

/** Data da precificação como data local (aceita "2026-05-10" sem virar o dia anterior). */
export function parsePricingDate(value: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Últimas precificações do período, mais recentes primeiro. */
export function getRecentActivity(pricings: PricingRecord[], limit = 5): PricingRecord[] {
  return [...withoutDeleted(pricings)]
    .sort(
      (left, right) =>
        (parsePricingDate(right.date)?.getTime() ?? 0) -
        (parsePricingDate(left.date)?.getTime() ?? 0)
    )
    .slice(0, limit);
}

/** O período selecionado é o mês corrente (comparação com mês anterior é parcial). */
export const isCurrentPeriod = (period: string, today = new Date()) =>
  period === toPeriodKey(today);

/** "R$ 12,3 mil", "R$ 1,2 mi" para eixos e rótulos curtos. */
export function formatCompactBRL(value: number): string {
  const abs = Math.abs(value);
  const format = (number: number, suffix: string) =>
    `R$ ${number.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}${suffix}`;
  if (abs >= 1_000_000) return format(value / 1_000_000, ' mi');
  if (abs >= 1_000) return format(value / 1_000, ' mil');
  return format(value, '');
}
