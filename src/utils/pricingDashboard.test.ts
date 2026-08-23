import { describe, expect, it } from 'vitest';
import { PricingRecord } from '../types';
import {
  buildCommercialRanking,
  buildFormulaRanking,
  calculatePricingDashboardStats,
  filterPricingsByPeriod,
  getPricingPeriodKey,
  getSixPeriodsEndingAt,
  scopePricingsForUser,
} from './pricingDashboard';
import type { User } from '../types';

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
      averageTicketValue: 20_000,
      conversionRate: 50,
      approvalRate: 100,
      averageMarginPerTon: 0,
    });
  });

  it('calculates commercial rates only from decided records and weights margin by tons', () => {
    const stats = calculatePricingDashboardStats([
      pricing({
        factors: { totalTons: 10, margin: 100 } as PricingRecord['factors'],
        summary: { totalSaleValue: 20_000 } as PricingRecord['summary'],
      }),
      pricing({
        factors: { totalTons: 30, margin: 300 } as PricingRecord['factors'],
        summary: { totalSaleValue: 60_000 } as PricingRecord['summary'],
      }),
      pricing({ status: 'Perdida', approvalStatus: 'Reprovada' }),
      pricing({ status: 'Em Andamento', approvalStatus: 'Pendente' }),
      pricing({ status: 'Excluída', approvalStatus: 'Reprovada' }),
    ]);

    expect(stats.averageTicketValue).toBe(40_000);
    expect(stats.conversionRate).toBeCloseTo(66.6667, 3);
    expect(stats.approvalRate).toBeCloseTo(66.6667, 3);
    expect(stats.averageMarginPerTon).toBe(250);
  });

  it('returns zero rates when there are no decided records', () => {
    const stats = calculatePricingDashboardStats([
      pricing({ status: 'Em Andamento', approvalStatus: 'Pendente' }),
    ]);

    expect(stats.averageTicketValue).toBe(0);
    expect(stats.conversionRate).toBe(0);
    expect(stats.approvalRate).toBe(0);
    expect(stats.averageMarginPerTon).toBe(0);
  });
});

describe('commercial dashboard hierarchy and rankings', () => {
  const user = (overrides: Partial<User>): User =>
    ({ id: 'user-1', role: 'user', managedUserIds: [], ...overrides }) as User;

  it('scopes sellers according to the current hierarchy', () => {
    const records = [
      pricing({ id: 'own', userId: 'user-1' }),
      pricing({ id: 'managed', userId: 'user-2' }),
      pricing({ id: 'outside', userId: 'user-3' }),
    ];

    expect(scopePricingsForUser(records, user({})).map(({ id }) => id)).toEqual(['own']);
    expect(
      scopePricingsForUser(
        records,
        user({ role: 'manager', managedUserIds: ['user-2'] })
      ).map(({ id }) => id)
    ).toEqual(['own', 'managed']);
    expect(scopePricingsForUser(records, user({ role: 'admin' }))).toHaveLength(3);
  });

  it('ranks only approved closed sales by realized value', () => {
    const ranking = buildCommercialRanking(
      [
        pricing({ userId: 'seller-1', userName: 'Vendedor A' }),
        pricing({
          userId: 'seller-2',
          userName: 'Vendedor B',
          factors: { totalTons: 20 } as PricingRecord['factors'],
          summary: { totalSaleValue: 50_000 } as PricingRecord['summary'],
        }),
        pricing({ userId: 'seller-1', userName: 'Vendedor A', status: 'Em Andamento' }),
      ],
      (record) => ({ id: record.userId, name: record.userName || 'Não informado' })
    );

    expect(ranking).toEqual([
      { id: 'seller-2', name: 'Vendedor B', salesValue: 50_000, tons: 20, salesCount: 1 },
      { id: 'seller-1', name: 'Vendedor A', salesValue: 20_000, tons: 10, salesCount: 1 },
    ]);
  });

  it('distributes multi-formula sales using each formula own value and volume', () => {
    const ranking = buildFormulaRanking([
      pricing({
        calculations: [
          {
            id: 'calc-1',
            formula: '20-05-20',
            factors: { totalTons: 10 } as PricingRecord['factors'],
            summary: { totalSaleValue: 20_000 } as PricingRecord['summary'],
          },
          {
            id: 'calc-2',
            formula: '10-10-10',
            factors: { totalTons: 30 } as PricingRecord['factors'],
            summary: { totalSaleValue: 45_000 } as PricingRecord['summary'],
          },
        ] as PricingRecord['calculations'],
      }),
    ]);

    expect(ranking).toEqual([
      { id: '10-10-10', name: '10-10-10', salesValue: 45_000, tons: 30, salesCount: 1 },
      { id: '20-05-20', name: '20-05-20', salesValue: 20_000, tons: 10, salesCount: 1 },
    ]);
  });

  it('supports legacy pricing records without calculations', () => {
    const ranking = buildFormulaRanking([
      pricing({ factors: { targetFormula: '04-14-08', totalTons: 12 } as PricingRecord['factors'] }),
    ]);

    expect(ranking[0]).toMatchObject({
      id: '04-14-08',
      name: '04-14-08',
      salesValue: 20_000,
      tons: 12,
    });
  });
});
