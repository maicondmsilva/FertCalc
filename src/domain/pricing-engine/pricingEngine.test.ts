import { describe, expect, it } from 'vitest';
import type { PricingFactors, RawMaterial } from '../../types';
import {
  calculateInterestDays,
  calculatePricingSummary,
  hasFormulaTarget,
  parseFormulaTarget,
} from '.';

const material: RawMaterial = {
  id: 'micro-1', type: 'micro', name: 'Zinco', price: 1000,
  n: 0, p: 0, k: 0, s: 0, ca: 0,
  microGuarantees: [{ name: 'Zn', value: 20 }],
  minQty: 0, maxQty: 1000, selected: true, quantity: 100,
};

const factors = (overrides: Partial<PricingFactors> = {}): PricingFactors => ({
  targetFormula: '00-00-00', factor: 1, discount: 0, margin: 0,
  freight: 0, tipoFrete: 'FOB', taxRate: 0, commission: 0,
  monthlyInterestRate: 0, dueDate: '', exemptCurrentMonth: false,
  client: { id: 'c', code: '1', name: 'Cliente', document: '' },
  agent: { id: 'a', code: '1', name: 'Agente', document: '' },
  branchId: 'b', priceListId: 'p', totalTons: 0, ...overrides,
});

describe('pricing engine compatibility', () => {
  it('trata desconto como valor absoluto e fator como multiplicador', () => {
    const result = calculatePricingSummary([material], [], factors({ factor: 1.5, discount: 10 }));
    expect(result.baseCost).toBe(100);
    expect(result.basePrice).toBe(140);
  });

  it('normaliza a garantia de micronutriente pelo peso total', () => {
    expect(calculatePricingSummary([], [material], factors()).resultingMicros.Zn).toBe(20);
  });

  it('ignora o restante do mês corrente quando solicitado', () => {
    const today = new Date(2026, 0, 10, 12);
    expect(calculateInterestDays('2026-02-10T12:00:00', true, today)).toBe(11);
  });
});

describe('formula engine', () => {
  it('aceita ponto ou vírgula nos três nutrientes', () => {
    expect(parseFormulaTarget('16,5-07-23')).toEqual({ n: 16.5, p: 7, k: 23 });
  });

  it('rejeita texto sem fórmula completa', () => {
    expect(hasFormulaTarget('Composição livre')).toBe(false);
    expect(parseFormulaTarget('10-20')).toBeNull();
  });
});
