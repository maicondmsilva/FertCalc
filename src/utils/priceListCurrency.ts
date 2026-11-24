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

const hasPrice = (value: unknown) => Number(value) > 0;

/**
 * A lista tem preços nesta moeda? Listas novas guardam reais em `price` e dólar
 * em `priceUSD`; listas antigas em dólar (currency = USD) guardam dólar em `price`.
 */
export function listHasCurrency(
  list: Pick<PriceList, 'currency' | 'macros' | 'micros'>,
  currency: PriceListCurrency
): boolean {
  const items = [...(list.macros || []), ...(list.micros || [])];
  if (list.currency === 'USD') return currency === 'USD' && items.length > 0;
  if (currency === 'BRL') return items.length > 0;
  return items.some((item) => hasPrice(item.priceUSD));
}

/** Moedas disponíveis na lista, na ordem R$, US$. */
export const listCurrencies = (list: Pick<PriceList, 'currency' | 'macros' | 'micros'>) =>
  (['BRL', 'USD'] as PriceListCurrency[]).filter((currency) => listHasCurrency(list, currency));

/** Câmbio da lista (R$ por US$), guardado num único campo. */
export const listExchangeRate = (
  list: Pick<PriceList, 'currency' | 'exchangeRate' | 'dollarRate'>
) => (list.currency === 'USD' ? list.exchangeRate : (list.dollarRate ?? list.exchangeRate));

/**
 * A lista vista numa moeda: preços daquela moeda e só os produtos que têm preço
 * nela (em reais, todos os produtos da lista continuam, como antes).
 */
export function projectPriceList(list: PriceList, currency: PriceListCurrency): PriceList {
  const rate = listExchangeRate(list);
  const legacyUsd = list.currency === 'USD';
  const project = (items: PriceList['macros']) => {
    if (legacyUsd) return currency === 'USD' ? items : [];
    if (currency === 'BRL') return items;
    return items
      .filter((item) => hasPrice(item.priceUSD))
      .map((item) => ({ ...item, price: Number(item.priceUSD) }));
  };
  return {
    ...list,
    currency,
    exchangeRate: currency === 'USD' ? rate : undefined,
    dollarRate: currency === 'BRL' ? rate : undefined,
    macros: project(list.macros || []),
    micros: project(list.micros || []),
  };
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
