import { describe, expect, it } from 'vitest';
import { RawMaterial, TargetFormula } from '../types';
import {
  addProdutoLivre,
  applyCalculationModeChange,
  applyProdutosLivresToMaterials,
  getCalculationMode,
  removeProdutoLivre,
  updateProdutoLivre,
} from '../utils/calculationMode';

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

  it('resets calc fields when switching mode', () => {
    const calc = {
      id: 'c1',
      formula: '20-00-20',
      selected: true,
      modo_calculo: 'formulacao',
      produtos_livres: [{ productId: 'macro-1', quantity: 250 }],
      macros: [createMaterial({ id: 'macro-1', selected: true, quantity: 250 })],
      micros: [createMaterial({ id: 'micro-1', type: 'micro', selected: true, quantity: 25 })],
    } as TargetFormula;

    const updated = applyCalculationModeChange(calc, 'produtos_livres', calc.macros, calc.micros);
    expect(updated.modo_calculo).toBe('produtos_livres');
    expect(updated.formula).toBe('');
    expect(updated.produtos_livres).toEqual([]);
    expect(updated.macros[0]).toMatchObject({ selected: false, quantity: 0 });
    expect(updated.micros[0]).toMatchObject({ selected: false, quantity: 0 });
  });

  it('adds products without duplicates and updates/removes quantities', () => {
    const initial = [{ productId: 'macro-1', quantity: 0 }];
    const withDuplicate = addProdutoLivre(initial, 'macro-1');
    expect(withDuplicate).toHaveLength(1);

    const withNew = addProdutoLivre(initial, 'micro-1');
    expect(withNew).toHaveLength(2);
    expect(withNew[1]).toEqual({ productId: 'micro-1', quantity: 0 });

    const withQty = updateProdutoLivre(withNew, 'micro-1', 50);
    expect(withQty[1]).toEqual({ productId: 'micro-1', quantity: 50 });

    const afterRemove = removeProdutoLivre(withQty, 'macro-1');
    expect(afterRemove).toEqual([{ productId: 'micro-1', quantity: 50 }]);
  });
});
