import type { PricingFactors, PricingSummary, RawMaterial } from '../../types';
import { convertPriceToBRL, getPricingCurrencyContext } from '../../utils/priceListCurrency';
import { applyCommercialWaterfall, roundMoney } from './commercialWaterfall';

const numberOrZero = (value: unknown): number => Number(value) || 0;

export interface PricingEngineOptions {
  today?: Date;
}

const DAY_IN_MILLISECONDS = 86_400_000;

const dateStringToUtcDay = (value: string): number | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return timestamp;
};

export function calculateMaterialComposition(macros: RawMaterial[], micros: RawMaterial[]) {
  const selected = [...macros.filter((m) => m.selected), ...micros.filter((m) => m.selected)];
  let totalWeight = 0;
  let baseCost = 0;
  let totalN = 0;
  let totalP = 0;
  let totalK = 0;
  let totalS = 0;
  let totalCa = 0;
  const micronutrients: Record<string, number> = {};

  selected.forEach((material) => {
    const quantity = numberOrZero(material.quantity);
    totalWeight += quantity;
    baseCost += (quantity / 1000) * numberOrZero(material.price);
    totalN += quantity * (numberOrZero(material.n) / 100);
    totalP += quantity * (numberOrZero(material.p) / 100);
    totalK += quantity * (numberOrZero(material.k) / 100);
    totalS += quantity * (numberOrZero(material.s) / 100);
    totalCa += quantity * (numberOrZero(material.ca) / 100);
    material.microGuarantees?.forEach((guarantee) => {
      micronutrients[guarantee.name] =
        (micronutrients[guarantee.name] || 0) + quantity * (numberOrZero(guarantee.value) / 100);
    });
  });

  const percentage = (amount: number) => (totalWeight > 0 ? (amount / totalWeight) * 100 : 0);
  return {
    totalWeight,
    baseCost,
    resultingN: percentage(totalN),
    resultingP: percentage(totalP),
    resultingK: percentage(totalK),
    resultingS: percentage(totalS),
    resultingCa: percentage(totalCa),
    resultingMicros: Object.fromEntries(
      Object.entries(micronutrients).map(([name, amount]) => [name, percentage(amount)])
    ),
  };
}

export function calculateInterestDays(
  dueDate: string | undefined,
  exemptCurrentMonth: boolean,
  today: Date,
  interestStartDate?: string
): number {
  if (!dueDate) return 0;
  const due = dateStringToUtcDay(dueDate);
  if (due === null) return 0;

  let start: number;
  if (exemptCurrentMonth) {
    start = Date.UTC(today.getFullYear(), today.getMonth() + 1, 1);
  } else if (interestStartDate) {
    const configuredStart = dateStringToUtcDay(interestStartDate);
    if (configuredStart === null) return 0;
    start = configuredStart;
  } else {
    start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  }

  return Math.max(0, Math.round((due - start) / DAY_IN_MILLISECONDS));
}

export function calculatePricingSummary(
  macros: RawMaterial[],
  micros: RawMaterial[],
  factors: PricingFactors,
  options: PricingEngineOptions = {}
): PricingSummary {
  const composition = calculateMaterialComposition(macros, micros);
  const adjustedCost = roundMoney(composition.baseCost * (numberOrZero(factors.factor) || 1));
  const days = calculateInterestDays(
    factors.dueDate,
    Boolean(factors.exemptCurrentMonth),
    options.today ?? new Date(),
    factors.interestStartDate
  );
  const freightType = factors.tipoFrete ?? (numberOrZero(factors.freight) > 0 ? 'CIF' : 'FOB');
  const commercial = applyCommercialWaterfall({
    adjustedCost,
    discount: factors.discount,
    packagingAdjustment: factors.embalagem_valor,
    monthlyInterestRate: factors.monthlyInterestRate,
    interestDays: days,
    commissionRate: factors.commission,
    taxRate: factors.taxRate,
    freight: freightType === 'CIF' ? factors.freight : 0,
  });
  const { basePrice, interestValue, taxValue, commissionValue, freightValue, finalPrice } =
    commercial;
  const totalSaleValue = roundMoney(finalPrice * numberOrZero(factors.totalTons));
  const currencyContext = getPricingCurrencyContext(factors);

  return {
    ...composition,
    currency: currencyContext.currency,
    exchangeRate: currencyContext.exchangeRate,
    exchangeRateSource: currencyContext.exchangeRateSource,
    exchangeRateValid: currencyContext.exchangeRateValid,
    basePrice,
    interestValue,
    taxValue,
    commissionValue,
    freightValue,
    finalPrice,
    totalSaleValue,
    baseCostBRL: convertPriceToBRL(composition.baseCost, currencyContext),
    basePriceBRL: convertPriceToBRL(basePrice, currencyContext),
    interestValueBRL: convertPriceToBRL(interestValue, currencyContext),
    taxValueBRL: convertPriceToBRL(taxValue, currencyContext),
    commissionValueBRL: convertPriceToBRL(commissionValue, currencyContext),
    freightValueBRL: convertPriceToBRL(freightValue, currencyContext),
    finalPriceBRL: convertPriceToBRL(finalPrice, currencyContext),
    totalSaleValueBRL: convertPriceToBRL(totalSaleValue, currencyContext),
  };
}
