import { describe, expect, it } from 'vitest';
import type { PriceList, RawMaterial } from '../types';
import { createPriceListPdfDocument } from './priceListPdfGenerator';

const material = (id: string, name: string, price: number): RawMaterial => ({
  id,
  name,
  price,
  type: 'macro',
  n: name.includes('Ureia') ? 46 : 0,
  p: 0,
  k: name.includes('KCL') ? 60 : 0,
  s: 0,
  ca: 0,
  microGuarantees: [],
  minQty: 0,
  maxQty: 1000,
  selected: true,
  quantity: 0,
});

const list = (id: string, localId: string, priceOffset: number): PriceList => ({
  id,
  name: 'Lista Setembro',
  local_carregamento_id: localId,
  date: '2026-09-01',
  currency: 'BRL',
  macros: [
    material('ureia', 'Ureia Granulada', 4300 + priceOffset),
    material('kcl', 'KCL Granulado', 3700 + priceOffset),
  ],
  micros: [],
});

describe('PDF da lista de preços', () => {
  it('gera um documento válido com múltiplos locais', () => {
    const document = createPriceListPdfDocument({
      group: {
        id: 'legacy:setembro:BRL',
        label: 'Lista Setembro',
        currency: 'BRL',
        competence: '2026-09-01',
        locations: [],
        sortOrder: 1,
      },
      lists: [list('1', 'uberaba', 0), list('2', 'catalao', 50)],
      locationNames: new Map([
        ['uberaba', 'Uberaba'],
        ['catalao', 'Catalão'],
      ]),
      settings: null,
    });

    expect(document.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(document.output('arraybuffer').byteLength).toBeGreaterThan(3000);
  });
});
