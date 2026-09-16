import { describe, it, expect } from 'vitest';
import { calcRentability } from './rentabilityUtils';

describe('calcRentability', () => {
  const baseInput = {
    unitaryPrice: 1500,
    factor: 1,
    baseCost: 1000,
    freightDeduction: 0,
    commissionRate: 0,
    interestRate: 0,
    taxRate: 0,
  };

  it('calcula rentabilidade simples sem deduções', () => {
    const result = calcRentability(baseInput);
    expect(result.baseCostAfterFactor).toBe(1000);
    expect(result.netRevenue).toBeCloseTo(1500);
    expect(result.profitability).toBeCloseTo(500);
    expect(result.profitabilityPercent).toBeCloseTo(50);
  });

  it('aplica fator ao custo base', () => {
    const result = calcRentability({ ...baseInput, factor: 1.2 });
    expect(result.baseCostAfterFactor).toBeCloseTo(1200);
    expect(result.profitability).toBeCloseTo(300);
  });

  it('aplica taxa de imposto corretamente', () => {
    const result = calcRentability({ ...baseInput, taxRate: 10 });
    // O preço informado já contém o imposto: 1500 / 1,10 = 1363,64.
    expect(result.taxDeduction).toBe(136.36);
    expect(result.netRevenue).toBe(1363.64);
  });

  it('aplica comissão corretamente', () => {
    const result = calcRentability({ ...baseInput, commissionRate: 5 });
    // A comissão é uma despesa direta de 5% sobre a receita elegível.
    expect(result.commissionDeduction).toBe(75);
    expect(result.netRevenue).toBe(1425);
  });

  it('calcula comissão sobre a venda após o frete', () => {
    const result = calcRentability({
      ...baseInput,
      unitaryPrice: 3030,
      baseCost: 3959.72,
      factor: 0.8,
      freightDeduction: 130,
      commissionRate: 1,
    });

    expect(result.commissionDeduction).toBe(29);
    expect(result.netRevenue).toBe(2871);
    expect(result.baseCostAfterFactor).toBe(3167.78);
    expect(result.profitability).toBe(-296.78);
    expect(result.profitabilityPercent).toBeCloseTo(-9.3687, 4);
  });

  it('aplica frete como dedução do preço', () => {
    const result = calcRentability({ ...baseInput, freightDeduction: 100 });
    expect(result.netRevenue).toBeCloseTo(1400);
  });

  it('retorna rentabilityPercent = 0 quando baseCostAfterFactor é zero', () => {
    const result = calcRentability({ ...baseInput, baseCost: 0 });
    expect(result.profitabilityPercent).toBe(0);
  });

  it('retorna daysOfInterest = 0 quando não há data de vencimento', () => {
    const result = calcRentability(baseInput);
    expect(result.daysOfInterest).toBe(0);
    expect(result.interestDeduction).toBe(0);
  });
});
