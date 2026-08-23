import { describe, expect, it } from 'vitest';
import type { PricingFactors, RawMaterial, TargetFormula } from '../../types';
import { calculateTargetFormula } from '.';

const material = (overrides: Partial<RawMaterial> = {}): RawMaterial => ({
  id: 'ureia',
  type: 'macro',
  name: 'Ureia',
  price: 2000,
  n: 45,
  p: 0,
  k: 0,
  s: 0,
  ca: 0,
  microGuarantees: [],
  minQty: 0,
  maxQty: 1000,
  selected: true,
  quantity: 0,
  ...overrides,
});

const factors: PricingFactors = {
  targetFormula: '45-00-00',
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
  totalTons: 1,
};

const calculation = (overrides: Partial<TargetFormula> = {}): TargetFormula => ({
  id: 'calc-1',
  formula: '45-00-00',
  selected: true,
  factors,
  macros: [material()],
  micros: [],
  ...overrides,
});

const execute = (target: TargetFormula) =>
  calculateTargetFormula({
    calculation: target,
    defaultMacros: [material()],
    defaultMicros: [],
    microsInGear: true,
    incompatibilityRules: [],
  });

describe('calculation orchestration engine', () => {
  it('resolve a fórmula NPK e produz o resumo comercial', () => {
    const result = execute(calculation());

    expect(result.issue).toBeUndefined();
    expect(result.calculation.macros[0].quantity).toBeCloseTo(1000);
    expect(result.calculation.summary?.resultingN).toBeCloseTo(45);
    expect(result.calculation.summary?.baseCost).toBeCloseTo(2000);
  });

  it('calcula composição livre usando a quantidade mínima configurada', () => {
    const result = execute(
      calculation({
        formula: 'Composição livre',
        macros: [material({ minQty: 250, quantity: 0 })],
      })
    );

    expect(result.issue).toBeUndefined();
    expect(result.calculation.macros[0].quantity).toBe(250);
    expect(result.calculation.summary?.totalWeight).toBe(250);
  });

  it('valida produtos livres antes de alterar a fórmula', () => {
    const target = calculation({
      formula: '',
      modo_calculo: 'produtos_livres',
      produtos_livres: [{ productId: 'inexistente', quantity: 100 }],
    });
    const result = execute(target);

    expect(result.calculation).toBe(target);
    expect(result.issue).toEqual({
      code: 'UNKNOWN_FREE_PRODUCT',
      productId: 'inexistente',
    });
  });

  it('preserva a composição e informa quando a fórmula é inviável', () => {
    const target = calculation({ formula: '00-00-60' });
    const result = execute(target);

    expect(result.issue).toEqual({ code: 'INFEASIBLE_FORMULA', formula: '00-00-60' });
    expect(result.calculation.macros[0].quantity).toBe(0);
    expect(result.calculation.summary?.totalWeight).toBe(0);
  });
});
