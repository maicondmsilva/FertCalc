import { describe, expect, it } from 'vitest';
import type { RawMaterial, TargetFormula } from '../../types';
import {
  approximateFormula,
  buildFormulaOptimizationModel,
  calculateMaterialComposition,
  calculateTargetFormula,
  diagnoseFormulaInfeasibility,
  optimizeFormula,
} from '.';

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

const ureia = material();
const filler = material({ id: 'filler', name: 'Enchimento', price: 100, n: 0 });
const magnesio = material({
  id: 'oxido-mg',
  type: 'micro',
  name: 'Óxido de Magnésio',
  price: 3000,
  n: 0,
  microGuarantees: [{ name: 'Magnésio', value: 50 }],
});

describe('magnésio com regra de faixa (igual a Ca e S)', () => {
  it('cria a faixa do alvo até +0,99 ponto e lê "Magnésio" ou "Mg"', () => {
    const model = buildFormulaOptimizationModel({
      target: { n: 10, p: 0, k: 0 },
      targetMg: 1,
      targetMicros: { Mg: 1 },
      macros: [ureia, filler],
      micros: [magnesio],
      incompatibilityRules: [],
    });

    expect(model.constraints.mg_eq).toEqual({ min: 10, max: 19.9 });
    expect(model.variables['oxido-mg'].mg_eq).toBe(0.5);
    // O Mg não vira também uma meta mínima de micronutriente.
    expect(Object.keys(model.constraints).some((key) => key.startsWith('micro_target'))).toBe(
      false
    );
  });

  it('não altera o modelo quando a meta de Mg não é informada', () => {
    const model = buildFormulaOptimizationModel({
      target: { n: 10, p: 0, k: 0 },
      targetMicros: { Mg: 1 },
      macros: [ureia, filler],
      micros: [magnesio],
      incompatibilityRules: [],
    });

    expect(model.constraints.mg_eq).toBeUndefined();
    expect(model.constraints.micro_target_0).toEqual({ min: 10 });
  });

  it('resolve a fórmula dentro da faixa de Mg e informa o Mg obtido', () => {
    const result = optimizeFormula({
      target: { n: 10, p: 0, k: 0 },
      targetMg: 1,
      macros: [ureia, filler],
      micros: [magnesio],
      incompatibilityRules: [],
    });

    expect(result.feasible).toBe(true);
    expect(result.composition.resultingMg).toBeGreaterThanOrEqual(1 - 1e-6);
    expect(result.composition.resultingMg).toBeLessThanOrEqual(1.99 + 1e-6);
  });

  it('calcula o Mg da composição a partir das garantias', () => {
    const composition = calculateMaterialComposition(
      [{ ...filler, quantity: 980 }],
      [{ ...magnesio, quantity: 20 }]
    );
    expect(composition.resultingMg).toBeCloseTo(1, 6);
  });

  it('aponta falta de fonte de Mg no diagnóstico', () => {
    const diagnostics = diagnoseFormulaInfeasibility({
      target: { n: 10, p: 0, k: 0 },
      targetMg: 1,
      macros: [ureia, filler],
      micros: [],
      incompatibilityRules: [],
    });
    expect(diagnostics.some((item) => item.nutrient === 'Mg')).toBe(true);
  });

  it('inclui o Mg na fórmula aproximada', () => {
    const approximation = approximateFormula({
      target: { n: 10, p: 0, k: 0 },
      targetMg: 1,
      macros: [ureia, filler],
      micros: [magnesio],
      incompatibilityRules: [],
    });
    expect(approximation.feasible).toBe(true);
    expect(approximation.composition.resultingMg).toBeCloseTo(1, 1);
  });

  it('usa a meta de Mg no cálculo da fórmula-alvo', () => {
    const calculation = {
      id: 'f1',
      formula: '10-00-00',
      selected: true,
      targetMg: 1,
      targetMicros: { Mg: 1 },
      macros: [ureia, filler],
      micros: [magnesio],
      factors: { factor: 1, totalTons: 1 },
    } as unknown as TargetFormula;

    const result = calculateTargetFormula({
      calculation,
      defaultMacros: [],
      defaultMicros: [],
      microsInGear: true,
      incompatibilityRules: [],
    });

    expect(result.issue).toBeUndefined();
    expect(result.calculation.summary?.resultingMg).toBeGreaterThanOrEqual(1 - 1e-6);
  });
});
