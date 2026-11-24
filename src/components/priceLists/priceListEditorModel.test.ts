import { describe, expect, it } from 'vitest';
import type { PriceList, RawMaterial } from '../../types';
import {
  buildPriceListSheetRows,
  canManagePriceLists,
  draftFromList,
  emptyDraft,
  filterMaterials,
  findZeroPriceItems,
  formatPriceInput,
  getDraftSaveProblem,
  isDraftDirty,
  materialGuarantees,
  moveMaterial,
  orderForDisplay,
  parsePriceInput,
} from './priceListEditorModel';

const material = (overrides: Partial<RawMaterial> = {}): RawMaterial => ({
  id: 'map',
  code: '101',
  type: 'macro',
  name: 'MAP Granulado',
  price: 7900,
  n: 11,
  p: 52,
  k: 0,
  s: 0,
  ca: 0,
  microGuarantees: [],
  minQty: 0,
  maxQty: 1000,
  selected: true,
  quantity: 0,
  ...overrides,
});

const list: PriceList = {
  id: 'lista-1',
  name: '611/2026',
  local_carregamento_id: 'uberaba',
  date: '2026-11-23',
  currency: 'BRL',
  dollarRate: 5.42,
  macros: [material(), material({ id: 'ureia', name: 'Ureia Granulada', code: '102', price: 0 })],
  micros: [],
};

describe('editor de lista de preço', () => {
  it('lê preço no formato brasileiro e com ponto decimal', () => {
    expect(parsePriceInput('7.900,50')).toBe(7900.5);
    expect(parsePriceInput('7900,5')).toBe(7900.5);
    expect(parsePriceInput('7900.5')).toBe(7900.5);
    expect(parsePriceInput('7.900')).toBe(7900);
    expect(parsePriceInput('R$ 4.840,00')).toBe(4840);
    expect(parsePriceInput('')).toBe(0);
    expect(parsePriceInput('-10')).toBe(0);
    expect(formatPriceInput(7900.5)).toBe('7.900,50');
    expect(formatPriceInput(0)).toBe('');
  });

  it('abre a lista como rascunho e como cópia', () => {
    const draft = draftFromList(list);
    expect(draft).toMatchObject({ id: 'lista-1', localId: 'uberaba', exchangeRate: 5.42 });
    const copy = draftFromList(list, true);
    expect(copy.id).toBeUndefined();
    expect(copy.name).toBe('611/2026 (cópia)');
    copy.macros[0].price = 1;
    expect(list.macros[0].price).toBe(7900);
  });

  it('aponta matérias-primas sem preço', () => {
    expect(findZeroPriceItems(draftFromList(list)).map((item) => item.name)).toEqual([
      'Ureia Granulada',
    ]);
  });

  it('só gerente ou acima gerencia listas (mesma regra do banco)', () => {
    expect(canManagePriceLists({ role: 'manager' })).toBe(true);
    expect(canManagePriceLists({ role: 'user' })).toBe(false);
  });

  it('busca por nome ou código sem diferenciar acentos', () => {
    const items = [material(), material({ id: 'nitrato', name: 'Nitrato de Amônio', code: '106' })];
    expect(filterMaterials(items, 'amonio').map((item) => item.id)).toEqual(['nitrato']);
    expect(filterMaterials(items, '101').map((item) => item.id)).toEqual(['map']);
    expect(filterMaterials(items, '  ')).toHaveLength(2);
  });

  it('mostra a linha diferenciada depois da convencional e reordena por arrastar', () => {
    const items = [
      material({ id: 'a', isPremiumLine: true }),
      material({ id: 'b' }),
      material({ id: 'c' }),
    ];
    expect(orderForDisplay(items).map((item) => item.id)).toEqual(['b', 'c', 'a']);
    expect(moveMaterial(items, 'c', 'a').map((item) => item.id)).toEqual(['c', 'a', 'b']);
    expect(moveMaterial(items, 'x', 'a')).toBe(items);
  });

  it('lista as garantias de macro e micro', () => {
    expect(
      materialGuarantees(material({ s: 8, microGuarantees: [{ name: 'Zn', value: 2 }] }))
    ).toEqual([
      { name: 'N', value: 11 },
      { name: 'P', value: 52 },
      { name: 'S', value: 8 },
      { name: 'Zn', value: 2 },
    ]);
  });

  it('detecta alterações não salvas', () => {
    const saved = draftFromList(list);
    expect(isDraftDirty(draftFromList(list), saved)).toBe(false);
    const changed = draftFromList(list);
    changed.macros[0].price = 8000;
    expect(isDraftDirty(changed, saved)).toBe(true);
    expect(isDraftDirty(emptyDraft())).toBe(false);
  });

  it('não salva sem nome, sem câmbio em dólar ou sem matéria-prima', () => {
    expect(getDraftSaveProblem({ ...draftFromList(list), name: ' ' })).toMatch('nome');
    expect(
      getDraftSaveProblem({ ...draftFromList(list), currency: 'USD', exchangeRate: 0 })
    ).toMatch('câmbio');
    expect(getDraftSaveProblem({ ...emptyDraft(), name: 'Nova' })).toMatch('matéria-prima');
    expect(getDraftSaveProblem(draftFromList(list))).toBeNull();
  });

  it('gera as linhas do Excel com local, moeda e preço', () => {
    const rows = buildPriceListSheetRows(draftFromList(list), 'Uberaba');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      Lista: '611/2026',
      Local: 'Uberaba',
      Moeda: 'BRL',
      'Matéria-prima': 'MAP Granulado',
      Garantias: 'N 11 · P 52',
      'Preço (R$/t)': 7900,
    });
  });
});
