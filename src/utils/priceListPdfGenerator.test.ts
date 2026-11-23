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

  it('cabe em uma página com uma lista do tamanho das reais', () => {
    const macros = Array.from({ length: 15 }, (_, index) => ({
      ...material(`macro-${index}`, `Matéria-prima granulada ${index + 1}`, 3000 + index * 90),
      n: index % 3 === 0 ? 11 : 0,
      p: index % 3 === 1 ? 52 : 0,
      k: index % 3 === 2 ? 60 : 0,
      s: index % 4 === 0 ? 8 : 0,
      ca: index % 5 === 0 ? 17 : 0,
      isPremiumLine: index >= 9,
    }));
    const micros = Array.from({ length: 15 }, (_, index) => ({
      ...material(`micro-${index}`, `Micronutriente ${index + 1}`, 9000 + index * 150),
      type: 'micro' as const,
      microGuarantees: [
        { name: ['B', 'Zn', 'Cu', 'Mn', 'Mg'][index % 5], value: 10 + index },
        { name: 'S', value: 5 },
      ],
    }));
    const realList = (id: string, localId: string, offset: number): PriceList => ({
      ...list(id, localId, offset),
      macros: macros.map((item) => ({ ...item, price: item.price + offset })),
      micros: micros.map((item) => ({ ...item, price: item.price + offset })),
    });

    const document = createPriceListPdfDocument({
      group: {
        id: 'legacy:611:BRL',
        label: 'Lista 611/2026',
        currency: 'BRL',
        competence: '2026-11-23',
        locations: [],
        sortOrder: 1,
        notes: 'Preços FOB; Sujeito a alteração sem aviso; Validade de 5 dias',
      },
      lists: [realList('1', 'a', 0), realList('2', 'b', 40), realList('3', 'c', 80)],
      locationNames: new Map([
        ['a', 'Uberaba'],
        ['b', 'Catalão'],
        ['c', 'Rio Verde'],
      ]),
      settings: null,
    });

    expect(document.getNumberOfPages()).toBe(1);
  });
});
