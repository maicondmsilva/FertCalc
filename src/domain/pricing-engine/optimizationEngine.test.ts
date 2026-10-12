import { describe, expect, it } from 'vitest';
import type { IncompatibilityRule, RawMaterial } from '../../types';
import { buildFormulaOptimizationModel, optimizeFormula } from '.';

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

const incompatibility: IncompatibilityRule = {
  id: 'r1',
  materialAId: 'ureia',
  materialBId: 'kcl',
  materialAName: 'Ureia',
  materialBName: 'KCl',
};

describe('LP optimization engine', () => {
  it('constrói metas NPK, peso e limites de material', () => {
    const model = buildFormulaOptimizationModel({
      target: { n: 45, p: 0, k: 0 },
      macros: [material()],
      micros: [],
      incompatibilityRules: [],
    });
    expect(model.constraints.n_eq).toEqual({ min: 450, max: 459 });
    expect(model.constraints.weight).toEqual({ equal: 1000 });
    expect(model.variables.ureia.weight).toBe(1);
    expect(model.ints.use_ureia).toBe(1);
    expect(model.constraints.use_limit_ureia).toEqual({ max: 1 });
    expect(model.variables.use_ureia.use_limit_ureia).toBe(1);
  });

  it('cria restrição binária para materiais incompatíveis selecionados', () => {
    const model = buildFormulaOptimizationModel({
      target: { n: 0, p: 0, k: 0 },
      macros: [material(), material({ id: 'kcl', name: 'KCl', n: 0, k: 60 })],
      micros: [],
      incompatibilityRules: [incompatibility],
    });
    expect(model.constraints.incomp_0).toEqual({ max: 1 });
    expect(model.variables.use_ureia.incomp_0).toBe(1);
    expect(model.variables.use_kcl.incomp_0).toBe(1);
  });

  it('resolve uma fórmula viável e devolve quantidades sem mutar a entrada', () => {
    const ureia = material();
    const result = optimizeFormula({
      target: { n: 45, p: 0, k: 0 },
      macros: [ureia],
      micros: [],
      incompatibilityRules: [],
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

  it('fecha 00-13-17 com B e Zn mesmo quando uma fonte ultrapassa outra garantia-alvo', () => {
    const fosforo = material({ id: 'fosforo', name: 'Fonte P', n: 0, p: 100, price: 10 });
    const potassio = material({ id: 'potassio', name: 'Fonte K', n: 0, k: 100, price: 10 });
    const enchimento = material({ id: 'enchimento', name: 'Enchimento', n: 0, price: 1 });
    const boroComZinco = material({
      id: 'boro-zinco',
      type: 'micro',
      name: 'Boro com Zinco',
      n: 0,
      price: 20,
      microGuarantees: [
        { name: 'B', value: 10 },
        { name: 'Zn', value: 20 },
      ],
    });

    const result = optimizeFormula({
      target: { n: 0, p: 13, k: 17 },
      targetMicros: { B: 0.21, Zn: 0.33 },
      macros: [fosforo, potassio, enchimento],
      micros: [boroComZinco],
      incompatibilityRules: [],
    });

    expect(result.feasible).toBe(true);
    expect(result.composition.resultingMicros.B).toBeGreaterThanOrEqual(0.21);
    expect(result.composition.resultingMicros.Zn).toBeGreaterThanOrEqual(0.33);
  });

  it('fecha 09-45-00 escolhendo múltiplas fontes para metas informadas como Boro e Zinco', () => {
    const fosforo = material({ id: 'map', name: 'MAP', n: 0, p: 100, price: 100 });
    const enchimento = material({ id: 'enchimento', name: 'Enchimento', n: 0, price: 0.01 });
    const microI = material({
      id: 'micro-i',
      type: 'micro',
      name: 'Micro I',
      n: 0,
      price: 1,
      maxQty: 70,
      microGuarantees: [{ name: 'B', value: 30 / 7 }],
    });
    const zinco10 = material({
      id: 'zinco-10',
      type: 'micro',
      name: 'Zinco 10%',
      n: 0,
      price: 1,
      maxQty: 50,
      microGuarantees: [{ name: 'Zn', value: 10 }],
    });
    const mastergranZinco = material({
      id: 'mastergran-zinco',
      type: 'micro',
      name: 'Mastergran Zinco',
      n: 0,
      price: 10,
      microGuarantees: [{ name: 'Zinco', value: 625 / 12 }],
    });

    const result = optimizeFormula({
      target: { n: 9, p: 45, k: 0 },
      targetMicros: { Boro: 0.3, Zinco: 1.25 },
      macros: [
        material({ id: 'ureia-45', name: 'Ureia', n: 45, price: 100 }),
        fosforo,
        enchimento,
      ],
      micros: [microI, zinco10, mastergranZinco],
      incompatibilityRules: [],
    });

    expect(result.feasible).toBe(true);
    expect(result.composition.resultingN).toBeGreaterThanOrEqual(9);
    expect(result.composition.resultingP).toBeGreaterThanOrEqual(45);
    expect(result.composition.resultingMicros.B).toBeGreaterThanOrEqual(0.3);
    expect(result.composition.resultingMicros.Zn).toBeGreaterThanOrEqual(1.25);
    expect(result.micros.find((item) => item.id === 'micro-i')?.quantity).toBeCloseTo(70, 2);
    expect(result.micros.find((item) => item.id === 'zinco-10')?.quantity).toBeCloseTo(50, 2);
    expect(result.micros.find((item) => item.id === 'mastergran-zinco')?.quantity).toBeCloseTo(
      14.4,
      2
    );
  });

  it('consolida aliases duplicados em uma única restrição de micronutriente', () => {
    const model = buildFormulaOptimizationModel({
      target: { n: 0, p: 0, k: 0 },
      targetMicros: { Zn: 1, Zinco: 1.25 },
      macros: [material({ id: 'enchimento', n: 0 })],
      micros: [
        material({
          id: 'zinco',
          type: 'micro',
          n: 0,
          microGuarantees: [{ name: 'ZN', value: 10 }],
        }),
      ],
      incompatibilityRules: [],
    });

    const microConstraints = Object.keys(model.constraints).filter((key) =>
      key.startsWith('micro_target_')
    );
    expect(microConstraints).toHaveLength(1);
    expect(model.constraints[microConstraints[0]]).toEqual({ min: 12.5 });
    expect(model.variables.zinco[microConstraints[0]]).toBe(0.1);
  });

  it('informa quando os materiais não conseguem fechar a fórmula', () => {
    const result = optimizeFormula({
      target: { n: 0, p: 0, k: 60 },
      macros: [material()],
      micros: [],
      incompatibilityRules: [],
    });
    expect(result.feasible).toBe(false);
  });
});
