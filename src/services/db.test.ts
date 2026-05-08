import { describe, expect, it, vi } from 'vitest';
import { TargetFormula } from '../types';

vi.mock('./supabase', () => ({
  supabase: {},
}));

import { normalizeCalculationsForDb } from './db';

describe('normalizeCalculationsForDb', () => {
  it('normalizes free product calculations with missing formula/summary fields', () => {
    const freeProductCalc: Partial<TargetFormula> = {
      modo_calculo: 'produtos_livres',
      produtos_livres: [{ productId: 'p1', quantity: 500 }],
      macros: [{ id: 'p1', quantity: 500, price: 1200 } as TargetFormula['macros'][number]],
      micros: [],
    };

    const calculations = normalizeCalculationsForDb([
      freeProductCalc as NonNullable<Parameters<typeof normalizeCalculationsForDb>[0]>[number],
    ]);

    expect(calculations[0].formula).toBe('Produtos Livres');
    expect(calculations[0].summary).toMatchObject({
      totalWeight: 500,
      baseCost: 600,
      finalPrice: 600,
      resultingN: 0,
      resultingP: 0,
      resultingK: 0,
    });
  });
});
