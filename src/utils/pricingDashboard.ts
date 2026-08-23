import { PricingRecord, User } from '../types';
import {
  getPricingTotalSaleValue,
  getPricingTotalTons,
  getPricingWeightedMargin,
} from './pricingMetrics';

export interface PricingDashboardStats {
  totalValue: number;
  totalValueInProgress: number;
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
        acc.tons += tons;
        acc.profitability += (Number(analysis.profitability) || 0) * tons;
        acc.baseCost += (Number(analysis.baseCostAfterFactor) || 0) * tons;
      });
      return acc;
    },
    { tons: 0, profitability: 0, baseCost: 0 }
  );
  const closedTons = approvedClosed.reduce(
    (sum, pricing) => sum + getPricingTotalTons(pricing),
    0
  );

  return {
    totalValue,
    totalValueInProgress: inProgress.reduce(
      (sum, pricing) => sum + getPricingTotalSaleValue(pricing),
      0
    ),
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
    profitabilityCoverageRate:
      closedTons > 0 ? (profitabilityTotals.tons / closedTons) * 100 : 0,
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
