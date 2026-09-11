import { describe, expect, it } from 'vitest';
import type { PriceListPublication } from '../types';
import { buildPriceListPdfGroups, type PriceListPdfSource } from './priceListPdfSelection';

const locations = new Map([
  ['uberaba', 'Carregamento Uberaba'],
  ['araguari', 'Carregamento Araguari'],
]);

describe('seleção de listas para PDF', () => {
  it('agrupa uma publicação e mantém somente a lista mais recente de cada local', () => {
    const publication: PriceListPublication = {
      id: 'publication-1',
      idNumeric: 7,
      name: 'Lista Setembro',
      competence: '2026-09-01',
      revision: 2,
      currency: 'USD',
      status: 'published',
    };
    const lists: PriceListPdfSource[] = [
      { id: '1', idNumeric: 10, publicationId: publication.id, name: 'A', localId: 'uberaba', date: '2026-09-01', currency: 'USD' },
      { id: '2', idNumeric: 12, publicationId: publication.id, name: 'A', localId: 'uberaba', date: '2026-09-02', currency: 'USD' },
      { id: '3', idNumeric: 11, publicationId: publication.id, name: 'A', localId: 'araguari', date: '2026-09-01', currency: 'USD' },
    ];

    const [group] = buildPriceListPdfGroups(lists, [publication], locations);
    expect(group.label).toBe('7 - Lista Setembro (rev. 2)');
    expect(group.locations.map((location) => location.listId)).toEqual(['3', '2']);
  });

  it('agrupa listas legadas pelo nome e moeda sem misturar BRL e USD', () => {
    const lists: PriceListPdfSource[] = [
      { id: '1', idNumeric: 10, name: '409/2026', localId: 'uberaba', date: '2026-09-01', currency: 'BRL' },
      { id: '2', idNumeric: 11, name: '409/2026', localId: 'araguari', date: '2026-09-01', currency: 'BRL' },
      { id: '3', idNumeric: 12, name: '409/2026', localId: 'uberaba', date: '2026-09-01', currency: 'USD' },
    ];

    const groups = buildPriceListPdfGroups(lists, [], locations);
    expect(groups).toHaveLength(2);
    expect(groups.find((group) => group.currency === 'BRL')?.locations).toHaveLength(2);
  });
});
