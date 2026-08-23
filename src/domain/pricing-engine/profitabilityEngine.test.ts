import { describe, expect, it } from 'vitest';
import { calculateProfitability, createProfitabilityAnalysis } from '.';

const input = {
  unitaryPrice: 1500,
  factor: 1,
  baseCost: 1000,
  freightDeduction: 100,
  commissionRate: 5,
  interestRate: 2,
  taxRate: 10,
  dueDate: '2026-02-15T12:00:00',
  exemptCurrentMonth: false,
  packagingValue: 25,
};

describe('profitability engine', () => {
  it('calcula deduções e rentabilidade com data determinística', () => {
    const result = calculateProfitability(input, { today: new Date('2026-01-16T12:00:00') });
    expect(result.daysOfInterest).toBe(30);
    expect(result.taxDeduction).toBe(150);
    expect(result.commissionDeduction).toBe(75);
    expect(result.interestDeduction).toBeCloseTo(28);
    expect(result.packagingDeduction).toBe(25);
    expect(result.netRevenue).toBeCloseTo(1122);
    expect(result.profitability).toBeCloseTo(122);
    expect(result.profitabilityPercent).toBeCloseTo(12.2);
  });

  it('aplica juros compostos proporcionalmente a uma fração de mês', () => {
    const result = calculateProfitability(
      { ...input, freightDeduction: 0, commissionRate: 0, taxRate: 0, packagingValue: 0 },
      { today: new Date('2026-01-31T12:00:00') }
    );
    expect(result.daysOfInterest).toBe(15);
    expect(result.interestDeduction).toBeCloseTo(1500 * (1 - Math.sqrt(0.98)));
  });

  it('cria o registro persistível com autoria e horário controlados', () => {
    const analyzedAt = new Date('2026-03-01T10:00:00Z');
    const analysis = createProfitabilityAnalysis(
      {
        ...input,
        pricingRecordId: 'pricing-1', calculationIndex: 2, formulaName: '16-07-23',
        analyzedByUserId: 'user-1', analyzedByName: 'Analista',
      },
      { today: new Date('2026-01-16T12:00:00'), analyzedAt }
    );
    expect(analysis.pricingRecordId).toBe('pricing-1');
    expect(analysis.calculationIndex).toBe(2);
    expect(analysis.analyzedByUserId).toBe('user-1');
    expect(analysis.analyzedAt).toBe(analyzedAt.toISOString());
    expect(analysis.profitability).toBeCloseTo(122);
  });
});
