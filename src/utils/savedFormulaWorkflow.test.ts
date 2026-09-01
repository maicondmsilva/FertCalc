import { describe, expect, it } from 'vitest';
import type { PriceList, RawMaterial, SavedFormula } from '../types';
import {
  getFormulaUpdateProtection,
  getPriceListsForLoadingLocation,
} from './savedFormulaWorkflow';

const material = (id: string, type: 'macro' | 'micro'): RawMaterial => ({
  id,
  type,
  name: id,
  price: 0,
  n: 0,
  p: 0,
  k: 0,
  s: 0,
  ca: 0,
  microGuarantees: [],
  minQty: 0,
  maxQty: 1000,
  selected: true,
  quantity: 10,
});

const formula: SavedFormula = {
  id: 'formula-1',
  userId: 'user-1',
  userName: 'Usuário',
  name: 'Formulação',
  date: '2026-09-01',
  targetFormula: '10-10-10',
  macros: [material('macro-1', 'macro')],
  micros: [material('micro-1', 'micro')],
  local_carregamento_id: 'local-1',
};

describe('saved formula workflow', () => {
  it('shows only price lists linked to the selected loading location', () => {
    const lists = [
      { id: 'list-1', local_carregamento_id: 'local-1' },
      { id: 'list-2', local_carregamento_id: 'local-2' },
    ] as PriceList[];

    expect(getPriceListsForLoadingLocation(lists, 'local-1').map((list) => list.id)).toEqual([
      'list-1',
    ]);
    expect(getPriceListsForLoadingLocation(lists, '')).toEqual([]);
  });

  it('allows a regular formula update while protecting micronutrients', () => {
    expect(getFormulaUpdateProtection(formula, false)).toMatchObject({
      canUpdate: true,
      protectedMaterialIds: ['micro-1'],
    });
  });

  it('blocks differentiated-line formula updates', () => {
    expect(getFormulaUpdateProtection(formula, true)).toMatchObject({
      canUpdate: false,
      protectedMaterialIds: ['macro-1', 'micro-1'],
    });
  });
});
