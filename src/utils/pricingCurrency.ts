import type { PriceListCurrency, PricingFactors, PricingRecord, PricingSummary } from '../types';

type SummaryMoneyField =
  | 'baseCost'
  | 'basePrice'
  | 'interestValue'
  | 'taxValue'
  | 'commissionValue'
  | 'freightValue'
  | 'finalPrice'
  | 'totalSaleValue';

export function getPricingCurrency(
  summary?: Partial<PricingSummary> | null,
  factors?: Partial<PricingFactors> | null
): PriceListCurrency {
  return summary?.currency || factors?.priceListCurrency || 'BRL';
}

export function getPricingExchangeRate(
  summary?: Partial<PricingSummary> | null,
  factors?: Partial<PricingFactors> | null
): number | undefined {
  const rate = Number(
    summary?.exchangeRate ?? factors?.appliedExchangeRate ?? factors?.priceListExchangeRate
  );
  return Number.isFinite(rate) && rate > 0 ? rate : undefined;
}

export function convertPricingMoneyToBRL(
  value: number,
  currency: PriceListCurrency,
  exchangeRate?: number
): number {
  if (currency === 'BRL') return Number(value) || 0;
  return exchangeRate && exchangeRate > 0 ? (Number(value) || 0) * exchangeRate : 0;
}

export function getPricingSummaryMoneyBRL(
  summary: Partial<PricingSummary> | undefined,
  factors: Partial<PricingFactors> | undefined,
  field: SummaryMoneyField
): number {
  if (!summary) return 0;
  const storedBRL = Number(summary[`${field}BRL` as keyof PricingSummary]);
  if (Number.isFinite(storedBRL) && storedBRL !== 0) return storedBRL;
  return convertPricingMoneyToBRL(
    Number(summary[field]) || 0,
    getPricingCurrency(summary, factors),
    getPricingExchangeRate(summary, factors)
  );
}

export function formatPricingMoney(
  value: number | undefined,
  currency: PriceListCurrency = 'BRL'
): string {
  return (Number(value) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPricingSummaryMoney(
  summary: Partial<PricingSummary> | undefined,
  factors: Partial<PricingFactors> | undefined,
  field: SummaryMoneyField,
  includeBRLEquivalent = true
): string {
  const currency = getPricingCurrency(summary, factors);
  const source = formatPricingMoney(Number(summary?.[field]) || 0, currency);
  if (currency !== 'USD' || !includeBRLEquivalent) return source;
  const brl = getPricingSummaryMoneyBRL(summary, factors, field);
  return brl > 0
    ? `${source} (${formatPricingMoney(brl, 'BRL')})`
    : `${source} (câmbio indisponível)`;
}

export function getPricingRecordCurrencies(pricing: PricingRecord): PriceListCurrency[] {
  const calculations = pricing.calculations?.length ? pricing.calculations : [pricing];
  return Array.from(
    new Set(
      calculations.map((calculation) =>
        getPricingCurrency(calculation.summary, calculation.factors)
      )
    )
  );
}

export function getPricingTotalSaleValueBRL(pricing: PricingRecord): number {
  if (pricing.calculations?.length) {
    return pricing.calculations.reduce(
      (total, calculation) =>
        total +
        getPricingSummaryMoneyBRL(calculation.summary, calculation.factors, 'totalSaleValue'),
      0
    );
  }
  return getPricingSummaryMoneyBRL(pricing.summary, pricing.factors, 'totalSaleValue');
}

export function getPricingTotalSaleValueSource(pricing: PricingRecord): number {
  if (pricing.calculations?.length) {
    return pricing.calculations.reduce(
      (total, calculation) => total + (Number(calculation.summary?.totalSaleValue) || 0),
      0
    );
  }
  return Number(pricing.summary?.totalSaleValue) || 0;
}

export function formatPricingRecordTotal(pricing: PricingRecord): string {
  const currencies = getPricingRecordCurrencies(pricing);
  const totalBRL = getPricingTotalSaleValueBRL(pricing);
  if (currencies.length !== 1) return formatPricingMoney(totalBRL, 'BRL');
  const currency = currencies[0];
  const source = formatPricingMoney(getPricingTotalSaleValueSource(pricing), currency);
  return currency === 'USD' ? `${source} (${formatPricingMoney(totalBRL, 'BRL')})` : source;
}

export function formatPricingRecordAveragePerTon(
  pricing: PricingRecord,
  totalTons: number
): string {
  if (totalTons <= 0) return formatPricingMoney(0, 'BRL');
  const currencies = getPricingRecordCurrencies(pricing);
  const averageBRL = getPricingTotalSaleValueBRL(pricing) / totalTons;
  if (currencies.length !== 1) return formatPricingMoney(averageBRL, 'BRL');
  const currency = currencies[0];
  const averageSource = getPricingTotalSaleValueSource(pricing) / totalTons;
  const source = formatPricingMoney(averageSource, currency);
  return currency === 'USD' ? `${source} (${formatPricingMoney(averageBRL, 'BRL')})` : source;
}
