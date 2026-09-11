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

  it('usa a data inicial específica também na rentabilidade', () => {
    const result = calculateProfitability(
      {
        ...input,
        dueDate: '2026-06-15T12:00:00',
        interestStartDate: '2026-03-15T12:00:00',
      },
      { today: new Date('2026-01-15T12:00:00') }
    );

    expect(result.daysOfInterest).toBe(92);
  });

  it('trata embalagem negativa como crédito na receita líquida', () => {
    const withoutPackaging = calculateProfitability(
      { ...input, packagingValue: 0 },
      { today: new Date('2026-01-16T12:00:00') }
    );
    const withPackagingCredit = calculateProfitability(
      { ...input, packagingValue: -50 },
      { today: new Date('2026-01-16T12:00:00') }
    );

    expect(withPackagingCredit.packagingDeduction).toBe(-50);
    expect(withPackagingCredit.netRevenue).toBeCloseTo(withoutPackaging.netRevenue + 50);
    expect(withPackagingCredit.profitability).toBeCloseTo(withoutPackaging.profitability + 50);
  });

  it('não gera crédito de juros quando o frete supera o valor da venda', () => {
    const result = calculateProfitability(
      { ...input, unitaryPrice: 100, freightDeduction: 150 },
      { today: new Date('2026-01-16T12:00:00') }
    );

    expect(result.interestDeduction).toBe(0);
    expect(Number.isFinite(result.netRevenue)).toBe(true);
  });

  it('cria o registro persistível com autoria e horário controlados', () => {
    const analyzedAt = new Date('2026-03-01T10:00:00Z');
    const analysis = createProfitabilityAnalysis(
      {
        ...input,
        pricingRecordId: 'pricing-1',
        calculationIndex: 2,
        formulaName: '16-07-23',
        analyzedByUserId: 'user-1',
        analyzedByName: 'Analista',
        paymentCondition: 'ddf',
        dataCarregamento: '2026-01-16',
        ddfDias: 30,
      },
      { today: new Date('2026-01-16T12:00:00'), analyzedAt }
    );
    expect(analysis.pricingRecordId).toBe('pricing-1');
    expect(analysis.calculationIndex).toBe(2);
    expect(analysis.analyzedByUserId).toBe('user-1');
    expect(analysis.analyzedAt).toBe(analyzedAt.toISOString());
    expect(analysis.profitability).toBeCloseTo(122);
    expect(analysis.paymentCondition).toBe('ddf');
    expect(analysis.dataCarregamento).toBe('2026-01-16');
    expect(analysis.ddfDias).toBe(30);
  });

  it('preserva a moeda de origem e grava o espelho financeiro em reais', () => {
    const analysis = createProfitabilityAnalysis(
      {
        ...input,
        currency: 'USD',
        exchangeRate: 5.2,
        pricingRecordId: 'pricing-usd',
        calculationIndex: 0,
        formulaName: '20-05-20',
        analyzedByUserId: 'user-1',
        analyzedByName: 'Analista',
      },
      { today: new Date('2026-01-16T12:00:00') }
    );

    expect(analysis.currency).toBe('USD');
    expect(analysis.exchangeRate).toBe(5.2);
    expect(analysis.unitaryPriceBRL).toBeCloseTo(analysis.unitaryPrice * 5.2);
    expect(analysis.netRevenueBRL).toBeCloseTo(analysis.netRevenue * 5.2);
    expect(analysis.profitabilityBRL).toBeCloseTo(analysis.profitability * 5.2);
  });
});
