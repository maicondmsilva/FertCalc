import type { PriceList, PriceListCurrency, PricingFactors } from '../types';

export interface PriceListCurrencySnapshot {
  priceListCurrency: PriceListCurrency;
  priceListExchangeRate?: number;
  appliedExchangeRate?: number;
  exchangeRateSource?: 'list';
}

export interface PricingCurrencyContext {
  currency: PriceListCurrency;
  exchangeRate?: number;
  exchangeRateSource?: 'list' | 'manual';
  exchangeRateValid: boolean;
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

export function getPricingCurrencyContext(
  factors: Pick<
    PricingFactors,
    'priceListCurrency' | 'priceListExchangeRate' | 'appliedExchangeRate' | 'exchangeRateSource'
  >
): PricingCurrencyContext {
  const currency = factors.priceListCurrency ?? 'BRL';
  if (currency === 'BRL') {
    return { currency, exchangeRate: 1, exchangeRateValid: true };
  }

  const appliedRate = isValidExchangeRate(factors.appliedExchangeRate)
    ? Number(factors.appliedExchangeRate)
    : undefined;
  const listRate = isValidExchangeRate(factors.priceListExchangeRate)
    ? Number(factors.priceListExchangeRate)
    : undefined;
  const exchangeRate = appliedRate ?? listRate;

  return {
    currency,
    exchangeRate,
    exchangeRateSource: exchangeRate
      ? appliedRate
        ? (factors.exchangeRateSource ?? 'list')
        : 'list'
      : undefined,
    exchangeRateValid: exchangeRate !== undefined,
  };
}

export function convertPriceToBRL(
  value: number,
  context: PricingCurrencyContext
): number | undefined {
  if (!context.exchangeRateValid || context.exchangeRate === undefined) return undefined;
  return context.currency === 'USD' ? value * context.exchangeRate : value;
}

export function hasValidPricingExchangeRate(
  factors: Pick<
    PricingFactors,
    'priceListCurrency' | 'priceListExchangeRate' | 'appliedExchangeRate'
  >
): boolean {
  return getPricingCurrencyContext(factors).exchangeRateValid;
}
