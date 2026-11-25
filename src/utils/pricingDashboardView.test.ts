import { describe, expect, it } from 'vitest';
import type { Goal, PricingRecord } from '../types';
import {
  buildStatusBreakdown,
  calculateGoalProgress,
  calculatePricingDashboardStats,
  formatCompactBRL,
  getRecentActivity,
  parsePricingDate,
  profitabilityAnalysisInBRL,
  withoutDeleted,
} from './pricingDashboard';

const pricing = (overrides: Partial<PricingRecord> = {}): PricingRecord =>
  ({
    id: crypto.randomUUID(),
    userId: 'u1',
    date: '2026-05-10',
    status: 'Fechada',
    approvalStatus: 'Aprovada',
    macros: [],
    micros: [],
    factors: { totalTons: 10 },
    summary: { totalSaleValue: 20_000 },
    ...overrides,
  }) as PricingRecord;

const goal = (overrides: Partial<Goal> = {}): Goal => ({
  id: 'g1',
  userId: 'u1',
  userName: 'Ana',
  type: 'monthly',
  targetValue: 40,
  month: 5,
  year: 2026,
  status: 'Aprovada',
  ...overrides,
});

describe('rentabilidade em dólar', () => {
  it('converte a análise em US$ para reais', () => {
    expect(
      profitabilityAnalysisInBRL({
        profitability: 100,
        baseCostAfterFactor: 400,
        currency: 'USD',
        exchangeRate: 5,
      })
    ).toEqual({ profitability: 500, baseCostAfterFactor: 2000 });
    expect(
      profitabilityAnalysisInBRL({
        profitability: 100,
        baseCostAfterFactor: 400,
        currency: 'USD',
        exchangeRate: 5,
        profitabilityBRL: 510,
      }).profitability
    ).toBe(510);
    expect(profitabilityAnalysisInBRL({ profitability: 100, baseCostAfterFactor: 400 })).toEqual({
      profitability: 100,
      baseCostAfterFactor: 400,
    });
  });

  it('o painel soma a rentabilidade em reais', () => {
    const usd = pricing({
      calculations: [
        {
          formula: '04-14-08',
          factors: { totalTons: 10 },
          summary: { totalSaleValue: 1 },
          profitabilityAnalysis: {
            profitability: 20,
            baseCostAfterFactor: 400,
            currency: 'USD',
            exchangeRate: 5,
          },
        },
      ] as never,
    });
    const stats = calculatePricingDashboardStats([usd]);
    expect(stats.totalProfitability).toBe(1000); // 20 US$ × 5 × 10 t
    expect(stats.profitabilityPercent).toBeCloseTo(5);
  });
});

describe('situação, meta e atividades', () => {
  it('ignora excluídas', () => {
    expect(withoutDeleted([pricing({ status: 'Excluída' }), pricing()])).toHaveLength(1);
  });

  it('separa fechadas aprovadas das que aguardam aprovação', () => {
    const items = buildStatusBreakdown([
      pricing(),
      pricing({ approvalStatus: 'Pendente' }),
      pricing({ status: 'Em Andamento', approvalStatus: 'Pendente' }),
      pricing({ status: 'Perdida' }),
      pricing({ status: 'Excluída' }),
    ]);
    expect(items.map((item) => [item.key, item.count])).toEqual([
      ['approved', 1],
      ['awaitingApproval', 1],
      ['inProgress', 1],
      ['lost', 1],
    ]);
  });

  it('meta compara só as vendas do próprio usuário', () => {
    const progress = calculateGoalProgress(
      [goal()],
      [pricing(), pricing({ userId: 'equipe' }), pricing({ status: 'Excluída' })],
      'u1',
      '2026-05'
    );
    expect(progress?.achievedTons).toBe(10);
    expect(progress?.percent).toBe(25);
  });

  it('meta zero não divide por zero; sem meta aprovada retorna null', () => {
    expect(
      calculateGoalProgress([goal({ targetValue: 0 })], [pricing()], 'u1', '2026-05')?.percent
    ).toBeNull();
    expect(
      calculateGoalProgress([goal({ status: 'Pendente' })], [pricing()], 'u1', '2026-05')
    ).toBeNull();
  });

  it('data sem hora fica no dia certo e atividades vêm da mais recente', () => {
    expect(parsePricingDate('2026-05-01')?.getDate()).toBe(1);
    expect(parsePricingDate('x')).toBeNull();
    const recent = getRecentActivity([
      pricing({ id: 'a', date: '2026-05-01' }),
      pricing({ id: 'b', date: '2026-05-20T10:00:00Z' }),
      pricing({ id: 'c', date: '2026-05-30', status: 'Excluída' }),
    ]);
    expect(recent.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('valor compacto', () => {
    expect(formatCompactBRL(1_250_000)).toBe('R$ 1,3 mi');
    expect(formatCompactBRL(12_300)).toBe('R$ 12,3 mil');
    expect(formatCompactBRL(950)).toBe('R$ 950');
  });
});
