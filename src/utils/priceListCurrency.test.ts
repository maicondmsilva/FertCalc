import { describe, expect, it } from 'vitest';
import type { PriceList } from '../types';
import {
  getPriceListCurrencySnapshot,
  isValidExchangeRate,
  priceListRequiresExchangeRate,
  convertPriceToBRL,
  getPricingCurrencyContext,
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
