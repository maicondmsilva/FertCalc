import { describe, expect, it } from 'vitest';
import type { RawMaterial, TargetFormula } from '../types';
import { resetCalculationForPriceList } from './priceListSelection';

const material = (id: string, type: 'macro' | 'micro'): RawMaterial => ({
  id,
  type,
  name: id,
  price: 100,
  n: 0,
  p: 0,
  k: 0,
  s: 0,
  ca: 0,
  microGuarantees: [],
  minQty: 0,
  maxQty: 1000,
  selected: type === 'macro',
  quantity: 0,
});

describe('resetCalculationForPriceList', () => {
  it('volta o filtro para todos e usa somente os produtos da nova lista', () => {
    const calculation = {
      id: 'calc-1',
      formula: '20-05-20',
      selected: true,
      category: 'nitrogenous',
      produtos_livres: [{ productId: 'antigo', quantity: 100 }],
      factors: { priceListId: 'lista-antiga' },
      macros: [material('antigo', 'macro')],
      micros: [],
      summary: { finalPrice: 1000 },
    } as TargetFormula;

    const updated = resetCalculationForPriceList(
      calculation,
      [material('macro-novo', 'macro')],
      [material('micro-novo', 'micro')],
      'lista-nova',
      { priceListCurrency: 'USD', priceListExchangeRate: 5.2, appliedExchangeRate: 5.2 },
      0
    );

    expect(updated.category).toBe('all');
    expect(updated.produtos_livres).toEqual([]);
    expect(updated.macros.map((item) => item.id)).toEqual(['macro-novo']);
    expect(updated.micros.map((item) => item.id)).toEqual(['micro-novo']);
    expect(updated.factors).toMatchObject({
      priceListId: 'lista-nova',
      priceListCurrency: 'USD',
      appliedExchangeRate: 5.2,
      factor: 0,
    });
    expect(updated.summary).toBeUndefined();
  });
});
