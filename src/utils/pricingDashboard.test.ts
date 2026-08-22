import { describe, expect, it } from 'vitest';
import { PricingRecord } from '../types';
import {
  calculatePricingDashboardStats,
  filterPricingsByPeriod,
  getPricingPeriodKey,
  getSixPeriodsEndingAt,
} from './pricingDashboard';

function pricing(overrides: Partial<PricingRecord> = {}): PricingRecord {
  return {
    id: crypto.randomUUID(),
    userId: 'user-1',
    date: '2026-05-10',
    status: 'Fechada',
    approvalStatus: 'Aprovada',
    macros: [],
    micros: [],
    factors: { totalTons: 10 } as PricingRecord['factors'],
    summary: { totalSaleValue: 20_000 } as PricingRecord['summary'],
    ...overrides,
  };
}

describe('pricing dashboard periods', () => {
  it('keeps date-only values in their declared month regardless of timezone', () => {
    expect(getPricingPeriodKey('2026-05-01')).toBe('2026-05');
  });

  it('filters the selected month and ignores invalid dates', () => {
    const records = [
      pricing({ date: '2026-05-31' }),
      pricing({ date: '2026-06-01' }),
      pricing({ date: 'invalid-date' }),
    ];

    expect(filterPricingsByPeriod(records, '2026-05')).toHaveLength(1);
    expect(filterPricingsByPeriod(records, '2026-06')).toHaveLength(1);
  });

  it('builds six periods correctly across a year boundary', () => {
    expect(getSixPeriodsEndingAt('2026-02').map(({ period }) => period)).toEqual([
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });
});

describe('pricing dashboard totals', () => {
  it('counts only approved closed records as completed sales', () => {
    const stats = calculatePricingDashboardStats([
      pricing(),
      pricing({
        approvalStatus: 'Pendente',
        summary: { totalSaleValue: 50_000 } as PricingRecord['summary'],
      }),
      pricing({
        status: 'Em Andamento',
        summary: { totalSaleValue: 5_000 } as PricingRecord['summary'],
      }),
      pricing({ status: 'Perdida' }),
    ]);

    expect(stats).toMatchObject({
      totalValue: 20_000,
      totalValueInProgress: 5_000,
      count: 4,
      closedCount: 1,
      inProgressCount: 1,
      lostCount: 1,
      closedTons: 10,
    });
  });
});
