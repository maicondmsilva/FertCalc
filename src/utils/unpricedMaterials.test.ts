import { describe, expect, it } from 'vitest';
import type { PriceList, RawMaterial } from '../types';
import { projectPriceList } from './priceListCurrency';
import { applyTemporaryMaterialPrice, withOfficialListPrice } from './temporaryMaterialPrice';
import { getPriceWarnings, isUnpricedMaterial, materialNames } from './unpricedMaterials';

const item = (id: string, price: number, priceUSD?: number) =>
  ({ id, name: id, type: 'macro', price, priceUSD }) as RawMaterial;

const list = {
  id: 'l1',
  name: 'Lista',
  currency: 'BRL',
  dollarRate: 5.4,
  macros: [item('ureia', 3000, 560), item('kcl', 0, 0), item('map', 2800)],
  micros: [],
} as unknown as PriceList;

describe('produtos da lista sem preço', () => {
  it('em dólar a calculadora recebe todos, zerados e marcados quando faltam', () => {
    const usd = projectPriceList(list, 'USD', { includeUnpriced: true });
    expect(usd.macros.map((m) => [m.id, m.price, m.isMissingListPrice])).toEqual([
      ['ureia', 560, false],
      ['kcl', 0, true],
      ['map', 0, true],
    ]);
  });

  it('sem a opção (PDF e relatórios) dólar continua só com os que têm preço', () => {
    expect(projectPriceList(list, 'USD').macros.map((m) => m.id)).toEqual(['ureia']);
  });

  it('em reais marca o produto sem preço', () => {
    const brl = projectPriceList(list, 'BRL', { includeUnpriced: true });
    expect(brl.macros.find((m) => m.id === 'kcl')?.isMissingListPrice).toBe(true);
    expect(brl.macros.find((m) => m.id === 'ureia')?.isMissingListPrice).toBe(false);
  });

  it('avisa selecionado sem preço e com valor informado pelo usuário', () => {
    const semPreco = { ...withOfficialListPrice(item('kcl', 0)), selected: true };
    const digitado = {
      ...applyTemporaryMaterialPrice(withOfficialListPrice(item('map', 0)), 2900),
      selected: true,
    };
    const normal = { ...withOfficialListPrice(item('ureia', 3000)), selected: true };
    const desmarcado = { ...withOfficialListPrice(item('gesso', 0)), selected: false };

    expect(isUnpricedMaterial(semPreco)).toBe(true);
    expect(digitado.isManualPrice).toBe(true);
    const warnings = getPriceWarnings([semPreco, digitado, normal, desmarcado]);
    expect(materialNames(warnings.unpriced)).toBe('kcl');
    expect(materialNames(warnings.manual)).toBe('map');
  });

  it('depois do cálculo olha só o que entrou na mistura', () => {
    const usado = { ...item('kcl', 0), selected: true, quantity: 120 } as RawMaterial;
    const naoUsado = { ...item('gesso', 0), selected: true, quantity: 0 } as RawMaterial;
    expect(getPriceWarnings([usado, naoUsado], { onlyUsed: true }).unpriced).toHaveLength(1);
  });
});
