import { describe, expect, it } from 'vitest';
import type { PriceList } from '../types';
import {
  getPriceListCurrencySnapshot,
  isValidExchangeRate,
  priceListRequiresExchangeRate,
  convertPriceToBRL,
  getPricingCurrencyContext,
  listCurrencies,
  projectPriceList,
} from './priceListCurrency';

const makeList = (overrides: Partial<PriceList> = {}): PriceList => ({
  id: 'list-1',
  name: 'Lista de teste',
  date: '2026-09-09',
  currency: 'BRL',
  macros: [],
  micros: [],
  ...overrides,
});

describe('pricing currency conversion', () => {
  it('usa câmbio manual antes do câmbio da lista', () => {
    const context = getPricingCurrencyContext({
      priceListCurrency: 'USD',
      priceListExchangeRate: 5,
      appliedExchangeRate: 5.25,
      exchangeRateSource: 'manual',
    });

    expect(context).toEqual({
      currency: 'USD',
      exchangeRate: 5.25,
      exchangeRateSource: 'manual',
      exchangeRateValid: true,
    });
    expect(convertPriceToBRL(100, context)).toBe(525);
  });

  it('mantém valores BRL sem alteração', () => {
    const context = getPricingCurrencyContext({ priceListCurrency: 'BRL' });
    expect(convertPriceToBRL(123.45, context)).toBe(123.45);
  });

  it('não converte USD quando não existe câmbio válido', () => {
    const context = getPricingCurrencyContext({ priceListCurrency: 'USD' });
    expect(context.exchangeRateValid).toBe(false);
    expect(convertPriceToBRL(100, context)).toBeUndefined();
  });
});

describe('price list currency metadata', () => {
  it('assume BRL para listas antigas sem moeda', () => {
    expect(getPriceListCurrencySnapshot(makeList({ currency: undefined }))).toEqual({
      priceListCurrency: 'BRL',
      priceListExchangeRate: undefined,
      appliedExchangeRate: undefined,
      exchangeRateSource: undefined,
    });
  });

  it('copia o cambio valido da lista USD para o snapshot', () => {
    expect(getPriceListCurrencySnapshot(makeList({ currency: 'USD', exchangeRate: 5.18 }))).toEqual(
      {
        priceListCurrency: 'USD',
        priceListExchangeRate: 5.18,
        appliedExchangeRate: 5.18,
        exchangeRateSource: 'list',
      }
    );
  });

  it('sinaliza lista USD sem cambio positivo', () => {
    expect(
      priceListRequiresExchangeRate(makeList({ currency: 'USD', exchangeRate: undefined }))
    ).toBe(true);
    expect(priceListRequiresExchangeRate(makeList({ currency: 'USD', exchangeRate: 0 }))).toBe(
      true
    );
    expect(priceListRequiresExchangeRate(makeList({ currency: 'USD', exchangeRate: 5.18 }))).toBe(
      false
    );
  });

  it('aceita somente taxas numericas, finitas e positivas', () => {
    expect(isValidExchangeRate(5.18)).toBe(true);
    expect(isValidExchangeRate('5.18')).toBe(true);
    expect(isValidExchangeRate(0)).toBe(false);
    expect(isValidExchangeRate(-1)).toBe(false);
    expect(isValidExchangeRate(Number.NaN)).toBe(false);
  });
});

describe('lista com preços em reais e dólar', () => {
  const item = (id: string, price: number, priceUSD?: number) =>
    ({
      id,
      name: id,
      type: 'macro',
      price,
      priceUSD,
      n: 0,
      p: 0,
      k: 0,
      s: 0,
      ca: 0,
      microGuarantees: [],
      minQty: 0,
      maxQty: 1000,
      selected: true,
      quantity: 0,
    }) as PriceList['macros'][number];
  const dual = {
    id: 'l1',
    name: '611/2026',
    date: '2026-11-24',
    currency: 'BRL',
    dollarRate: 5.4,
    macros: [item('map', 7900, 1460), item('ureia', 4840)],
    micros: [item('zn', 9800, 1800)],
  } as PriceList;

  it('mostra as moedas que a lista tem', () => {
    expect(listCurrencies(dual)).toEqual(['BRL', 'USD']);
    expect(listCurrencies({ ...dual, macros: [item('ureia', 4840)], micros: [] })).toEqual(['BRL']);
    expect(listCurrencies({ ...dual, currency: 'USD' })).toEqual(['USD']);
  });

  it('em reais usa o preço em reais e mantém todos os produtos', () => {
    const brl = projectPriceList(dual, 'BRL');
    expect(brl.currency).toBe('BRL');
    expect(brl.macros.map((m) => [m.id, m.price])).toEqual([
      ['map', 7900],
      ['ureia', 4840],
    ]);
    expect(brl.dollarRate).toBe(5.4);
  });

  it('em dólar usa o preço em dólar, só os produtos com preço e o câmbio da lista', () => {
    const usd = projectPriceList(dual, 'USD');
    expect(usd.currency).toBe('USD');
    expect(usd.exchangeRate).toBe(5.4);
    expect(usd.macros.map((m) => [m.id, m.price])).toEqual([['map', 1460]]);
    expect(usd.micros.map((m) => [m.id, m.price])).toEqual([['zn', 1800]]);
    expect(getPriceListCurrencySnapshot(usd)).toMatchObject({
      priceListCurrency: 'USD',
      appliedExchangeRate: 5.4,
    });
  });

  it('lista antiga em dólar continua em dólar', () => {
    const legacy = {
      ...dual,
      currency: 'USD',
      exchangeRate: 5.1,
      dollarRate: undefined,
    } as PriceList;
    expect(projectPriceList(legacy, 'USD').macros.map((m) => m.price)).toEqual([7900, 4840]);
    expect(projectPriceList(legacy, 'BRL').macros).toEqual([]);
  });
});
