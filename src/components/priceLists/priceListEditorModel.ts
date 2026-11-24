import type { MacroMaterial, MicroMaterial, PriceList, RawMaterial, User } from '../../types';

export type PriceListCurrencyCode = 'BRL' | 'USD';
export type MaterialTab = 'macro' | 'micro';

/** Rascunho da lista aberta no editor (nova, existente ou cópia). */
export interface PriceListDraft {
  id?: string;
  name: string;
  localId: string;
  currency: PriceListCurrencyCode;
  /** Câmbio da lista em dólar ou câmbio de referência da lista em reais. */
  exchangeRate: number;
  macros: RawMaterial[];
  micros: RawMaterial[];
}

export const emptyDraft = (): PriceListDraft => ({
  name: '',
  localId: '',
  currency: 'BRL',
  exchangeRate: 0,
  macros: [],
  micros: [],
});

export function draftFromList(list: PriceList, asCopy = false): PriceListDraft {
  const currency: PriceListCurrencyCode = list.currency === 'USD' ? 'USD' : 'BRL';
  return {
    id: asCopy ? undefined : list.id,
    name: asCopy ? `${list.name} (cópia)` : list.name,
    localId: list.local_carregamento_id || '',
    currency,
    exchangeRate: Number(currency === 'USD' ? list.exchangeRate : list.dollarRate) || 0,
    macros: (list.macros || []).map((item) => ({ ...item })),
    micros: (list.micros || []).map((item) => ({ ...item })),
  };
}

/** Igual ao banco: gerente, admin e master criam, editam, arquivam e excluem listas. */
export const canManagePriceLists = (user: Pick<User, 'role'>) =>
  user.role === 'master' || user.role === 'admin' || user.role === 'manager';

/** Matérias-primas da lista sem preço (zero ou vazio). */
export const findZeroPriceItems = (draft: Pick<PriceListDraft, 'macros' | 'micros'>) =>
  [...draft.macros, ...draft.micros].filter((item) => !(Number(item.price) > 0));

/** Lê o preço digitado no formato brasileiro ("7.900,50") ou com ponto decimal ("7900.5"). */
export function parsePriceInput(raw: string): number {
  const text = raw.trim().replace(/[^\d.,-]/g, '');
  if (!text) return 0;
  const normalized = text.includes(',')
    ? text.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(\.\d{3})+$/.test(text)
      ? text.replace(/\./g, '')
      : text;
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : 0;
}

export const formatPriceInput = (value: number) =>
  Number(value) > 0
    ? Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '';

const normalize = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR');

/** Busca por nome ou código da matéria-prima, sem diferenciar acentos. */
export function filterMaterials(items: RawMaterial[], query: string): RawMaterial[] {
  const term = normalize(query.trim());
  if (!term) return items;
  return items.filter(
    (item) => normalize(item.name).includes(term) || normalize(item.code || '').includes(term)
  );
}

/** Linha convencional primeiro, linha diferenciada depois, mantendo a ordem de cada grupo. */
export const orderForDisplay = (items: RawMaterial[]) => [
  ...items.filter((item) => !item.isPremiumLine),
  ...items.filter((item) => item.isPremiumLine),
];

/** Move um item para a posição de outro (arrastar e soltar). */
export function moveMaterial(items: RawMaterial[], fromId: string, toId: string): RawMaterial[] {
  if (fromId === toId) return items;
  const from = items.findIndex((item) => item.id === fromId);
  const to = items.findIndex((item) => item.id === toId);
  if (from < 0 || to < 0) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Garantias que aparecem como etiquetas na linha da matéria-prima. */
export function materialGuarantees(item: RawMaterial): Array<{ name: string; value: number }> {
  const macros = [
    { name: 'N', value: item.n },
    { name: 'P', value: item.p },
    { name: 'K', value: item.k },
    { name: 'Ca', value: item.ca },
    { name: 'S', value: item.s },
  ].filter((guarantee) => Number(guarantee.value) > 0);
  const micros = (item.microGuarantees || [])
    .filter((guarantee) => Number(guarantee.value) > 0)
    .map((guarantee) => ({ name: guarantee.name, value: guarantee.value }));
  return [...macros, ...micros];
}

export function macroToRow(material: MacroMaterial): RawMaterial {
  return {
    id: material.id,
    code: material.code,
    type: 'macro',
    name: material.name,
    price: 0,
    n: material.n,
    p: material.p,
    k: material.k,
    s: material.s,
    ca: material.ca,
    microGuarantees: material.microGuarantees || [],
    minQty: 0,
    maxQty: 1000,
    selected: true,
    quantity: 0,
    categories: material.categories,
    isPremiumLine: material.isPremiumLine,
    formulaSuffix: material.formulaSuffix,
  };
}

export function microToRow(material: MicroMaterial): RawMaterial {
  return {
    id: material.id,
    code: material.code,
    type: 'micro',
    name: material.name,
    price: 0,
    n: 0,
    p: 0,
    k: 0,
    s: 0,
    ca: 0,
    microGuarantees: material.microGuarantees || [],
    minQty: 0,
    maxQty: 1000,
    selected: true,
    quantity: 0,
    categories: material.categories,
  };
}

/** Compara o rascunho com a lista salva para saber se há alterações não salvas. */
export function isDraftDirty(draft: PriceListDraft, saved?: PriceListDraft): boolean {
  const reference = saved ?? emptyDraft();
  const snapshot = (value: PriceListDraft) =>
    JSON.stringify({
      name: value.name.trim(),
      localId: value.localId,
      currency: value.currency,
      exchangeRate: Number(value.exchangeRate) || 0,
      macros: value.macros.map((item) => [item.id, Number(item.price) || 0]),
      micros: value.micros.map((item) => [item.id, Number(item.price) || 0]),
    });
  return snapshot(draft) !== snapshot(reference);
}

/** Problema que impede salvar o rascunho, ou null. */
export function getDraftSaveProblem(draft: PriceListDraft): string | null {
  if (!draft.name.trim()) return 'Dê um nome para a lista.';
  if (draft.currency === 'USD' && !(Number(draft.exchangeRate) > 0)) {
    return 'Informe o câmbio para salvar uma lista em dólar.';
  }
  if (draft.macros.length + draft.micros.length === 0) {
    return 'Adicione ao menos uma matéria-prima.';
  }
  return null;
}

/** Linhas da planilha Excel da lista (uma por matéria-prima). */
export function buildPriceListSheetRows(draft: PriceListDraft, localName: string) {
  const symbol = draft.currency === 'USD' ? 'US$' : 'R$';
  const row = (item: RawMaterial, tipo: string) => ({
    Código: item.code || '',
    'Matéria-prima': item.name,
    Tipo: tipo,
    Linha: item.isPremiumLine ? 'Diferenciada' : 'Convencional',
    Garantias: materialGuarantees(item)
      .map((guarantee) => `${guarantee.name} ${guarantee.value}`)
      .join(' · '),
    [`Preço (${symbol}/t)`]: Number(item.price) || 0,
  });
  return [
    ...orderForDisplay(draft.macros).map((item) => row(item, 'Macro')),
    ...draft.micros.map((item) => ({ ...row(item, 'Micro'), Linha: '' })),
  ].map((line) => ({ Lista: draft.name, Local: localName, Moeda: draft.currency, ...line }));
}
