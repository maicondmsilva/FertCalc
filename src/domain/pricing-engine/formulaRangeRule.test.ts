import { describe, expect, it } from 'vitest';
import type { RawMaterial, TargetFormula } from '../../types';
import { calculateTargetFormula } from '.';
import { getCalculationSaveBlockReason } from '../../utils/pricingValidation';

const material = (overrides: Partial<RawMaterial>): RawMaterial => ({
  id: 'x',
  type: 'macro',
  name: 'X',
  price: 0,
  n: 0,
  p: 0,
  k: 0,
  s: 0,
  ca: 0,
  microGuarantees: [],
  minQty: 50,
  maxQty: 0,
  selected: true,
  quantity: 0,
  ...overrides,
});

// Produtos e preços da lista 511/2026 (mínimo de 50 kg quando usados).
const listaReal = [
  material({ id: 'map', name: 'Map Gr.', price: 7900, n: 11, p: 52 }),
  material({ id: '0021', name: '00-21 Gr.', price: 3605, p: 21, s: 8, ca: 17 }),
  material({ id: 'kcl', name: 'KCL', price: 4005, k: 60 }),
  material({ id: 'ureia', name: 'Ureia Gr.', price: 4840, n: 46 }),
];

const run = (calculation: Partial<TargetFormula>, macros = listaReal) =>
  calculateTargetFormula({
    calculation: {
      id: 'f1',
      selected: true,
      formula: '',
      macros,
      micros: [],
      factors: { factor: 1, totalTons: 1 },
      ...calculation,
    } as TargetFormula,
    defaultMacros: macros,
    defaultMicros: [],
    microsInGear: true,
    incompatibilityRules: [],
  });

describe('regra da folga de até 0,99 acima do alvo', () => {
  it('fecha 05-25-15 com MAP, 00-21, KCl e ureia sem passar de 5,99 no N', () => {
    const result = run({ formula: '05-25-15' });
    const summary = result.calculation.summary!;

    expect(result.issue).toBeUndefined();
    expect(result.calculation.notClosed).toBeUndefined();
    // A ureia tem mínimo de 50 kg: isso leva o N a ~5,95, dentro da folga.
    expect(summary.resultingN).toBeGreaterThanOrEqual(5 - 1e-6);
    expect(summary.resultingN).toBeLessThanOrEqual(5.99 + 1e-6);
    expect(summary.resultingP).toBeGreaterThanOrEqual(25 - 1e-6);
    expect(summary.resultingP).toBeLessThanOrEqual(25.99 + 1e-6);
    expect(summary.resultingK).toBeGreaterThanOrEqual(15 - 1e-6);
    expect(summary.resultingK).toBeLessThanOrEqual(15.99 + 1e-6);
  });

  it('aplica a mesma folga a Ca e S quando informados', () => {
    const result = run({ formula: '05-25-15', targetS: 3, targetCa: 6 });
    const summary = result.calculation.summary!;
    if (result.issue) {
      expect(result.calculation.notClosed).toBe(true);
      return;
    }
    expect(summary.resultingS).toBeGreaterThanOrEqual(3 - 1e-6);
    expect(summary.resultingS).toBeLessThanOrEqual(3.99 + 1e-6);
    expect(summary.resultingCa).toBeGreaterThanOrEqual(6 - 1e-6);
    expect(summary.resultingCa).toBeLessThanOrEqual(6.99 + 1e-6);
  });

  it('quando não fecha, mostra o resultado mais próximo e nunca o do cálculo anterior', () => {
    // MAP limitado: o restante do P vem do DAP, que leva o N mínimo a 6,04.
    const macros = [
      material({ id: 'map', name: 'MAP', price: 4150, n: 11, p: 52, minQty: 0, maxQty: 400 }),
      material({ id: 'dap', name: 'DAP', price: 4000, n: 18, p: 46, minQty: 0 }),
      material({ id: 'kcl', name: 'KCl', price: 3200, k: 60, minQty: 0 }),
      material({ id: 'ench', name: 'Enchimento', price: 180, minQty: 0 }),
    ];
    const first = run({ formula: '07-25-15' }, macros);
    expect(first.issue).toBeUndefined();

    const second = run({ ...first.calculation, formula: '05-25-15' }, macros);
    expect(second.issue?.code).toBe('INFEASIBLE_FORMULA');
    expect(second.calculation.notClosed).toBe(true);
    const shown = second.calculation.summary!;
    const suggestion = second.calculation.approximation!;
    // O resultado mostrado é o da sugestão (mais próximo, mais barato), não o do 07-25-15.
    expect(shown.resultingN).toBeCloseTo(suggestion.summary.resultingN, 6);
    expect(shown.resultingN).toBeLessThan(first.calculation.summary!.resultingN);
    expect(suggestion.suggestedFormula).toMatch(/^6,0\d?-25-15$/);
    expect(getCalculationSaveBlockReason(second.calculation)).toContain('não fecha');
  });
});

describe('bloqueio ao salvar', () => {
  it('não salva fórmula alterada e ainda não calculada', () => {
    expect(
      getCalculationSaveBlockReason({ formula: '05-25-15', summary: undefined } as TargetFormula)
    ).toContain('Calcule');
    expect(
      getCalculationSaveBlockReason({
        formula: '05-25-15',
        summary: { finalPrice: 1 },
      } as unknown as TargetFormula)
    ).toBeNull();
  });
});
