import { describe, expect, it } from 'vitest';
import type { PricingFactors, RawMaterial } from '../../types';
import {
  calculateInterestDays,
  calculateMaterialComposition,
  calculatePricingSummary,
  hasFormulaTarget,
  parseFormulaTarget,
} from '.';

const material: RawMaterial = {
  id: 'micro-1',
  type: 'micro',
  name: 'Zinco',
  price: 1000,
  n: 0,
  p: 0,
  k: 0,
  s: 0,
  ca: 0,
  microGuarantees: [{ name: 'Zn', value: 20 }],
  minQty: 0,
  maxQty: 1000,
  selected: true,
  quantity: 100,
};

const factors = (overrides: Partial<PricingFactors> = {}): PricingFactors => ({
  targetFormula: '00-00-00',
  factor: 1,
  discount: 0,
  margin: 0,
  freight: 0,
  tipoFrete: 'FOB',
  taxRate: 0,
  commission: 0,
  monthlyInterestRate: 0,
  dueDate: '',
  exemptCurrentMonth: false,
  client: { id: 'c', code: '1', name: 'Cliente', document: '' },
  agent: { id: 'a', code: '1', name: 'Agente', document: '' },
  branchId: 'b',
  priceListId: 'p',
  totalTons: 0,
  ...overrides,
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

  it('soma somente materiais selecionados e calcula todas as garantias', () => {
    const selected = {
      ...material,
      id: 'macro-1',
      type: 'macro' as const,
      price: 2000,
      quantity: 600,
      n: 10,
      p: 20,
      k: 30,
      s: 4,
      ca: 2,
      microGuarantees: [],
    };
    const ignored = { ...selected, id: 'macro-2', selected: false, quantity: 400 };

    const result = calculateMaterialComposition([selected, ignored], []);

    expect(result.totalWeight).toBe(600);
    expect(result.baseCost).toBe(1200);
    expect(result.resultingN).toBeCloseTo(10);
    expect(result.resultingP).toBeCloseTo(20);
    expect(result.resultingK).toBeCloseTo(30);
    expect(result.resultingS).toBeCloseTo(4);
    expect(result.resultingCa).toBeCloseTo(2);
  });

  it('combina juros, imposto, comissão, frete CIF e embalagem no preço final', () => {
    const result = calculatePricingSummary(
      [material],
      [],
      factors({
        factor: 2,
        discount: 10,
        monthlyInterestRate: 3,
        dueDate: '2026-01-31T12:00:00',
        taxRate: 10,
        commission: 5,
        freight: 40,
        tipoFrete: 'CIF',
        embalagem_valor: 5,
        totalTons: 2.5,
      }),
      { today: new Date('2026-01-01T12:00:00') }
    );

    expect(result.basePrice).toBe(190);
    expect(result.interestValue).toBeCloseTo(5.7);
    expect(result.taxValue).toBeCloseTo(19);
    expect(result.commissionValue).toBeCloseTo(9.5);
    expect(result.freightValue).toBe(40);
    expect(result.finalPrice).toBeCloseTo(269.2);
    expect(result.totalSaleValue).toBeCloseTo(673);
  });

  it('não inclui frete informado quando a modalidade é FOB', () => {
    const result = calculatePricingSummary(
      [material],
      [],
      factors({ freight: 80, tipoFrete: 'FOB' })
    );

    expect(result.freightValue).toBe(0);
    expect(result.finalPrice).toBe(result.basePrice);
  });

  it('trata vencimento passado ou inválido como zero dias de juros', () => {
    const today = new Date('2026-02-01T12:00:00');

    expect(calculateInterestDays('2026-01-01T12:00:00', false, today)).toBe(0);
    expect(calculateInterestDays('data-invalida', false, today)).toBe(0);
  });

  it('produz composição finita e zerada quando não há materiais', () => {
    const result = calculateMaterialComposition([], []);

    expect(result).toEqual({
      totalWeight: 0,
      baseCost: 0,
      resultingN: 0,
      resultingP: 0,
      resultingK: 0,
      resultingS: 0,
      resultingCa: 0,
      resultingMicros: {},
    });
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
