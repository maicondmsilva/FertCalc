import { describe, expect, it } from 'vitest';
import { RawMaterial, TargetFormula } from '../types';
import { applyProdutosLivresToMaterials, getCalculationMode } from '../utils/calculationMode';

const createMaterial = (overrides: Partial<RawMaterial>): RawMaterial => ({
  id: overrides.id || 'material-1',
  type: overrides.type || 'macro',
  name: overrides.name || 'Material',
  price: overrides.price ?? 1000,
  n: overrides.n ?? 0,
  p: overrides.p ?? 0,
  k: overrides.k ?? 0,
  s: overrides.s ?? 0,
  ca: overrides.ca ?? 0,
  microGuarantees: overrides.microGuarantees || [],
  minQty: overrides.minQty ?? 0,
  maxQty: overrides.maxQty ?? 1000,
  selected: overrides.selected ?? false,
  quantity: overrides.quantity ?? 0,
});

describe('useCalculator helpers', () => {
  it('returns Formulação NPK as default mode', () => {
    const calc = { id: '1', formula: '', selected: true } as TargetFormula;
    expect(getCalculationMode(calc)).toBe('formulacao');
  });

  it('maps produtos livres quantities to macro and micro materials', () => {
    const macro = createMaterial({ id: 'macro-1', type: 'macro', minQty: 10, maxQty: 800 });
    const micro = createMaterial({ id: 'micro-1', type: 'micro', minQty: 5, maxQty: 100 });

    const { nextMacros, nextMicros } = applyProdutosLivresToMaterials(
      [
        { productId: 'macro-1', quantity: 1000 },
        { productId: 'micro-1', quantity: 50 },
      ],
      [macro],
      [micro]
    );

    expect(nextMacros[0]).toMatchObject({
      selected: true,
      quantity: 1000,
      minQty: 1000,
      maxQty: 1000,
    });
    expect(nextMicros[0]).toMatchObject({
      selected: true,
      quantity: 50,
      minQty: 50,
      maxQty: 50,
    });
  });
});
