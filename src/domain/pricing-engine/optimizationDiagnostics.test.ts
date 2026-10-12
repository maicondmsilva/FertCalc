import { describe, expect, it } from 'vitest';
import type { IncompatibilityRule, RawMaterial } from '../../types';
import { diagnoseFormulaInfeasibility, formatOptimizationDiagnostics } from '.';

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

const diagnose = (
  macros: RawMaterial[],
  overrides: Partial<Parameters<typeof diagnoseFormulaInfeasibility>[0]> = {}
) =>
  diagnoseFormulaInfeasibility({
    target: { n: 0, p: 0, k: 0 },
    macros,
    micros: [],
    incompatibilityRules: [],
    ...overrides,
  });

describe('diagnóstico de inviabilidade do solver', () => {
  it('identifica ausência de produtos selecionados', () => {
    expect(diagnose([material({ selected: false })])[0].code).toBe('NO_SELECTED_MATERIALS');
  });

  it('identifica limites inválidos e capacidade total abaixo de 1.000 kg', () => {
    const diagnostics = diagnose([
      material({ name: 'Produto A', minQty: 500, maxQty: 400 }),
      material({ id: 'b', name: 'Produto B', n: 0, maxQty: 300 }),
    ]);

    expect(diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining(['INVALID_PRODUCT_LIMIT', 'WEIGHT_CAPACITY_BELOW_BATCH'])
    );
  });

  it('identifica produtos fixos acima do peso e incompatíveis', () => {
    const rules: IncompatibilityRule[] = [
      {
        id: 'rule',
        materialAId: 'ureia',
        materialBId: 'kcl',
        materialAName: 'Ureia',
        materialBName: 'KCl',
      },
    ];
    const diagnostics = diagnose(
      [
        material({ minQty: 600, maxQty: 600 }),
        material({ id: 'kcl', name: 'KCl', n: 0, k: 60, minQty: 500, maxQty: 500 }),
      ],
      { incompatibilityRules: rules }
    );

    expect(diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining(['FIXED_WEIGHT_EXCEEDS_BATCH', 'FIXED_INCOMPATIBILITY'])
    );
  });

  it('distingue fonte ausente de capacidade insuficiente para o nutriente', () => {
    const missing = diagnose([material()], { target: { n: 0, p: 0, k: 60 } });
    const insufficient = diagnose([material({ maxQty: 500 })], {
      target: { n: 45, p: 0, k: 0 },
    });

    expect(missing).toContainEqual(
      expect.objectContaining({
        code: 'NUTRIENT_SOURCE_MISSING',
        nutrient: 'K',
      })
    );
    expect(insufficient).toContainEqual(
      expect.objectContaining({
        code: 'NUTRIENT_CAPACITY_INSUFFICIENT',
        nutrient: 'N',
        available: 22.5,
      })
    );
  });

  it('explica quando uma quantidade fixa já excede o alvo, inclusive alvo NPK zero', () => {
    const diagnostics = diagnose([material({ minQty: 100, maxQty: 100 })]);

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'FIXED_NUTRIENT_EXCEEDS_TARGET',
        nutrient: 'N',
        available: 4.5,
      })
    );
  });

  it('limita a mensagem exibida sem perder o diagnóstico estruturado', () => {
    const diagnostics = diagnose([
      material({ minQty: 600, maxQty: 600 }),
      material({ id: 'b', name: 'Produto B', n: 0, minQty: 500, maxQty: 500 }),
    ]);

    expect(formatOptimizationDiagnostics(diagnostics, 1)).toBe(diagnostics[0].message);
  });
});
