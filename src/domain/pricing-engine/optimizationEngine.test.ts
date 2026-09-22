import { describe, expect, it } from 'vitest';
import type { IncompatibilityRule, RawMaterial } from '../../types';
import { buildFormulaOptimizationModel, optimizeFormula } from '.';

const material = (overrides: Partial<RawMaterial> = {}): RawMaterial => ({
  id: 'ureia', type: 'macro', name: 'Ureia', price: 2000,
  n: 45, p: 0, k: 0, s: 0, ca: 0, microGuarantees: [],
  minQty: 0, maxQty: 1000, selected: true, quantity: 0, ...overrides,
});

const incompatibility: IncompatibilityRule = {
  id: 'r1', materialAId: 'ureia', materialBId: 'kcl',
  materialAName: 'Ureia', materialBName: 'KCl',
};

describe('LP optimization engine', () => {
  it('constrói metas NPK, peso e limites de material', () => {
    const model = buildFormulaOptimizationModel({
      target: { n: 45, p: 0, k: 0 }, macros: [material()], micros: [], incompatibilityRules: [],
    });
    expect(model.constraints.n_eq).toEqual({ min: 450, max: 459 });
    expect(model.constraints.weight).toEqual({ equal: 1000 });
    expect(model.variables.ureia.weight).toBe(1);
    expect(model.ints.use_ureia).toBe(1);
  });

  it('cria restrição binária para materiais incompatíveis selecionados', () => {
    const model = buildFormulaOptimizationModel({
      target: { n: 0, p: 0, k: 0 },
      macros: [material(), material({ id: 'kcl', name: 'KCl', n: 0, k: 60 })],
      micros: [], incompatibilityRules: [incompatibility],
    });
    expect(model.constraints.incomp_0).toEqual({ max: 1 });
    expect(model.variables.use_ureia.incomp_0).toBe(1);
    expect(model.variables.use_kcl.incomp_0).toBe(1);
  });

  it('resolve uma fórmula viável e devolve quantidades sem mutar a entrada', () => {
    const ureia = material();
    const result = optimizeFormula({
      target: { n: 45, p: 0, k: 0 }, macros: [ureia], micros: [], incompatibilityRules: [],
    });
    expect(result.feasible).toBe(true);
    expect(result.macros[0].quantity).toBeCloseTo(1000);
    expect(ureia.quantity).toBe(0);
  });

  it('calcula S e Ca resultantes mesmo quando não há metas para esses nutrientes', () => {
    const result = optimizeFormula({
      target: { n: 45, p: 0, k: 0 },
      macros: [material({ s: 12, ca: 4 })],
      micros: [],
      incompatibilityRules: [],
    });
    expect(result.feasible).toBe(true);
    expect(result.composition.resultingS).toBeCloseTo(12);
    expect(result.composition.resultingCa).toBeCloseTo(4);
  });

  it('atinge as metas principais de Ca e S usando garantias cadastradas nos micros', () => {
    const filler = material({ id: 'enchimento', n: 0, price: 1 });
    const calciumAndSulfur = material({
      id: 'micro-ca-s',
      type: 'micro',
      name: 'Fonte de Ca e S',
      n: 0,
      price: 20,
      microGuarantees: [
        { name: 'Ca', value: 10 },
        { name: 'S', value: 20 },
      ],
    });

    const result = optimizeFormula({
      target: { n: 0, p: 0, k: 0 },
      targetCa: 0.5,
      targetS: 1,
      macros: [filler],
      micros: [calciumAndSulfur],
      incompatibilityRules: [],
    });

    expect(result.feasible).toBe(true);
    expect(result.micros[0].quantity).toBeCloseTo(50);
    expect(result.composition.resultingCa).toBeCloseTo(0.5);
    expect(result.composition.resultingS).toBeCloseTo(1);
    expect(result.composition.resultingMicros).toEqual({});
  });

  it('atinge a meta de micro somando garantias de macros e micros selecionados', () => {
    const macroComBoro = material({
      id: 'macro-boro',
      name: 'Macro com Boro',
      n: 0,
      price: 10,
      minQty: 500,
      maxQty: 500,
      microGuarantees: [{ name: 'B', value: 0.1 }],
    });
    const boro = material({
      id: 'boro',
      type: 'micro',
      name: 'Boro 5%',
      n: 0,
      price: 20,
      microGuarantees: [{ name: 'B', value: 5 }],
    });
    const enchimento = material({
      id: 'enchimento',
      name: 'Enchimento',
      n: 0,
      price: 1,
    });

    const result = optimizeFormula({
      target: { n: 0, p: 0, k: 0 },
      targetMicros: { B: 0.3 },
      macros: [macroComBoro, enchimento],
      micros: [boro],
      incompatibilityRules: [],
    });

    expect(result.feasible).toBe(true);
    expect(result.macros.find((item) => item.id === 'macro-boro')?.quantity).toBeCloseTo(500);
    expect(result.micros[0].quantity).toBeCloseTo(50);
    expect(result.composition.resultingMicros.B).toBeCloseTo(0.3);
  });

  it('informa quando os materiais não conseguem fechar a fórmula', () => {
    const result = optimizeFormula({
      target: { n: 0, p: 0, k: 60 }, macros: [material()], micros: [], incompatibilityRules: [],
    });
    expect(result.feasible).toBe(false);
  });
});
