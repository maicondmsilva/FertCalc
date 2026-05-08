import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: {},
}));

import { normalizeCalculationsForDb } from './db';

describe('normalizeCalculationsForDb', () => {
  it('normalizes produto livre calculations with missing formula/summary fields', () => {
    const calculations = normalizeCalculationsForDb([
      {
        modo_calculo: 'produtos_livres',
        produtos_livres: [{ productId: 'p1', quantity: 500 }],
        macros: [{ id: 'p1', quantity: 500, price: 1200 }],
        micros: [],
        summary: {},
      } as any,
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
