import { describe, expect, it } from 'vitest';
import type { RawMaterial } from '../../types';
import { approximateFormula } from '.';

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

describe('sugestão de fórmula aproximada', () => {
  it('sugere o NPK viável mais próximo quando o alvo exato não fecha', () => {
    const result = approximateFormula({
      target: { n: 50, p: 0, k: 0 },
      macros: [material()],
      micros: [],
      incompatibilityRules: [],
    });

    expect(result.feasible).toBe(true);
    expect(result.composition.resultingN).toBeCloseTo(45);
    expect(result.macros[0].quantity).toBeCloseTo(1000);
    expect(result.deviationScore).toBeCloseTo(5);
  });

  it('aproxima micronutrientes sem violar o máximo do produto', () => {
    const result = approximateFormula({
      target: { n: 0, p: 0, k: 0 },
      targetMicros: { Zinco: 1.25 },
      macros: [material({ id: 'filler', name: 'Enchimento', n: 0, price: 100 })],
      micros: [
        material({
          id: 'zn',
          type: 'micro',
          name: 'Zinco 10%',
          n: 0,
          price: 500,
          maxQty: 50,
          microGuarantees: [{ name: 'Zn', value: 10 }],
        }),
      ],
      incompatibilityRules: [],
    });

    expect(result.feasible).toBe(true);
    expect(result.micros[0].quantity).toBeCloseTo(50);
    expect(result.achievedMicroTargets.Zinco).toBeCloseTo(0.5);
    expect(result.deviationScore).toBeCloseTo(0.75);
  });

  it('prioriza o menor desvio e usa o custo para desempatar', () => {
    const result = approximateFormula({
      target: { n: 50, p: 0, k: 0 },
      macros: [
        material({ id: 'expensive', name: 'Fonte cara', price: 3000 }),
        material({ id: 'cheap', name: 'Fonte barata', price: 1000 }),
      ],
      micros: [],
      incompatibilityRules: [],
    });

    expect(result.feasible).toBe(true);
    expect(result.macros.find(({ id }) => id === 'cheap')?.quantity).toBeCloseTo(1000);
    expect(result.macros.find(({ id }) => id === 'expensive')?.quantity).toBeCloseTo(0);
  });

  it('não oferece sugestão quando as restrições estruturais são impossíveis', () => {
    const result = approximateFormula({
      target: { n: 10, p: 0, k: 0 },
      macros: [
        material({ minQty: 600, maxQty: 600 }),
        material({ id: 'fixed', n: 0, minQty: 500, maxQty: 500 }),
      ],
      micros: [],
      incompatibilityRules: [],
    });

    expect(result.feasible).toBe(false);
  });
});
