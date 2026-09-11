import type { PriceListCurrency, PriceListPublication } from '../types';

export interface PriceListPdfSource {
  id: string;
  idNumeric?: number;
  publicationId?: string;
  name: string;
  localId?: string;
  date: string;
  currency: PriceListCurrency;
}

export interface PriceListPdfLocationOption {
  listId: string;
  listIdNumeric?: number;
  localId: string;
  localName: string;
}

export interface PriceListPdfGroup {
  id: string;
  label: string;
  currency: PriceListCurrency;
  publicationId?: string;
  locations: PriceListPdfLocationOption[];
  sortOrder: number;
}

const normalizeName = (name: string) => name.trim().toLocaleLowerCase('pt-BR');

export function buildPriceListPdfGroups(
  lists: PriceListPdfSource[],
  publications: PriceListPublication[],
  locationNames: Map<string, string>
): PriceListPdfGroup[] {
  const publicationMap = new Map(publications.map((publication) => [publication.id, publication]));
  const grouped = new Map<string, PriceListPdfSource[]>();

  lists.forEach((list) => {
    const key = list.publicationId
      ? `publication:${list.publicationId}`
      : `legacy:${normalizeName(list.name)}:${list.currency}`;
    grouped.set(key, [...(grouped.get(key) ?? []), list]);
  });

  return Array.from(grouped.entries())
    .map(([id, groupLists]) => {
      const newestFirst = [...groupLists].sort(
        (a, b) => (b.idNumeric ?? 0) - (a.idNumeric ?? 0)
      );
      const publication = newestFirst[0].publicationId
        ? publicationMap.get(newestFirst[0].publicationId)
        : undefined;
      const latestByLocation = new Map<string, PriceListPdfSource>();

      newestFirst.forEach((list) => {
        const localKey = list.localId || `unlinked:${list.id}`;
        if (!latestByLocation.has(localKey)) latestByLocation.set(localKey, list);
      });

      const locations = Array.from(latestByLocation.values())
        .map((list) => ({
          listId: list.id,
          listIdNumeric: list.idNumeric,
          localId: list.localId || `unlinked:${list.id}`,
          localName: list.localId
            ? locationNames.get(list.localId) || 'Local não encontrado'
            : 'Sem local vinculado',
        }))
        .sort((a, b) => a.localName.localeCompare(b.localName, 'pt-BR'));

      return {
        id,
        label: publication
          ? `${publication.idNumeric} - ${publication.name} (rev. ${publication.revision})`
          : `${newestFirst[0].name} (${newestFirst[0].currency})`,
        currency: publication?.currency ?? newestFirst[0].currency,
        publicationId: publication?.id,
        locations,
        sortOrder: publication?.idNumeric ?? newestFirst[0].idNumeric ?? 0,
      };
    })
    .sort((a, b) => b.sortOrder - a.sortOrder);
}
