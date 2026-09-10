import { describe, expect, it } from 'vitest';
import type { RawMaterial } from '../types';
import {
  applyTemporaryMaterialPrice,
  restoreOfficialMaterialPrice,
  stripTemporaryMaterialPrices,
  withOfficialListPrice,
} from './temporaryMaterialPrice';

const material = { id: '1', name: 'Ureia', price: 500, type: 'macro' } as RawMaterial;

describe('temporary material prices', () => {
  it('preserves the official price before applying a temporary override', () => {
    const result = applyTemporaryMaterialPrice(withOfficialListPrice(material), 525.5);
    expect(result).toMatchObject({ price: 525.5, listPrice: 500, isManualPrice: true });
  });

  it('restores the official list price', () => {
    const overridden = applyTemporaryMaterialPrice(withOfficialListPrice(material), 525.5);
    expect(restoreOfficialMaterialPrice(overridden)).toMatchObject({
      price: 500,
      listPrice: 500,
      isManualPrice: false,
    });
  });

  it('does not persist a temporary price in a saved formula', () => {
    const overridden = applyTemporaryMaterialPrice(withOfficialListPrice(material), 525.5);
    expect(stripTemporaryMaterialPrices([overridden])[0]).toMatchObject({ price: 500 });
    expect(stripTemporaryMaterialPrices([overridden])[0]).not.toHaveProperty('isManualPrice');
  });
});
