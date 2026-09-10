import type { PriceList, PriceListCurrency } from '../types';

export interface PriceListCurrencySnapshot {
  priceListCurrency: PriceListCurrency;
  priceListExchangeRate?: number;
  appliedExchangeRate?: number;
  exchangeRateSource?: 'list';
}

export function isValidExchangeRate(value: unknown): boolean {
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0;
}

export function getPriceListCurrencySnapshot(list: PriceList): PriceListCurrencySnapshot {
  const priceListCurrency = list.currency ?? 'BRL';
  const listRate = priceListCurrency === 'USD' ? list.exchangeRate : list.dollarRate;
  const validRate = isValidExchangeRate(listRate) ? Number(listRate) : undefined;

  return {
    priceListCurrency,
    priceListExchangeRate: validRate,
    appliedExchangeRate: validRate,
    exchangeRateSource: validRate ? 'list' : undefined,
  };
}

export function priceListRequiresExchangeRate(list: PriceList): boolean {
  return (list.currency ?? 'BRL') === 'USD' && !isValidExchangeRate(list.exchangeRate);
}
