import { PricingRecord } from '../types';
import { getPricingTotalSaleValue, getPricingTotalTons } from './pricingMetrics';

export interface PricingDashboardStats {
  totalValue: number;
  totalValueInProgress: number;
  count: number;
  closedCount: number;
  inProgressCount: number;
  lostCount: number;
  closedTons: number;
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

  return {
    totalValue: approvedClosed.reduce((sum, pricing) => sum + getPricingTotalSaleValue(pricing), 0),
    totalValueInProgress: inProgress.reduce(
      (sum, pricing) => sum + getPricingTotalSaleValue(pricing),
      0
    ),
    count: pricings.length,
    closedCount: approvedClosed.length,
    inProgressCount: inProgress.length,
    lostCount: pricings.filter((pricing) => pricing.status === 'Perdida').length,
    closedTons: approvedClosed.reduce((sum, pricing) => sum + getPricingTotalTons(pricing), 0),
  };
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
