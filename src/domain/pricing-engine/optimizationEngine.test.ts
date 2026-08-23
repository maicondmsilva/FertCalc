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

  it('informa quando os materiais não conseguem fechar a fórmula', () => {
    const result = optimizeFormula({
      target: { n: 0, p: 0, k: 60 }, macros: [material()], micros: [], incompatibilityRules: [],
    });
    expect(result.feasible).toBe(false);
  });
});
