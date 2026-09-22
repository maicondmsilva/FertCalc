import type { PricingFactors, PricingSummary, RawMaterial } from '../../types';
import { convertPriceToBRL, getPricingCurrencyContext } from '../../utils/priceListCurrency';
import { applyCommercialWaterfall, roundMoney } from './commercialWaterfall';

const numberOrZero = (value: unknown): number => Number(value) || 0;

const micronutrientKey = (name: string) =>
  name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleUpperCase('pt-BR');

const micronutrientLabel = (name: string) => {
  const trimmedName = name.trim();
  return /^[a-z]{1,3}$/i.test(trimmedName)
    ? `${trimmedName.charAt(0).toLocaleUpperCase('pt-BR')}${trimmedName.slice(1).toLocaleLowerCase('pt-BR')}`
    : trimmedName;
};

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
  const micronutrients = new Map<string, { label: string; amount: number }>();

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
      const key = micronutrientKey(guarantee.name);
      if (!key) return;
      const current = micronutrients.get(key);
      micronutrients.set(key, {
        label: current?.label || micronutrientLabel(guarantee.name),
        amount: (current?.amount || 0) + quantity * (numberOrZero(guarantee.value) / 100),
      });
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
      Array.from(micronutrients.values()).map(({ label, amount }) => [label, percentage(amount)])
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
  const currencyContext = getPricingCurrencyContext(factors);
  const days = calculateInterestDays(
    factors.dueDate,
    Boolean(factors.exemptCurrentMonth),
    options.today ?? new Date(),
    factors.interestStartDate
  );
  const freightType = factors.tipoFrete ?? (numberOrZero(factors.freight) > 0 ? 'CIF' : 'FOB');
  const useMixedCurrencyWaterfall =
    currencyContext.currency === 'USD' &&
    currencyContext.exchangeRateValid &&
    currencyContext.exchangeRate !== undefined;
  const exchangeRate = currencyContext.exchangeRate ?? 1;
  const adjustedCostForWaterfall = useMixedCurrencyWaterfall
    ? roundMoney((adjustedCost - numberOrZero(factors.discount)) * exchangeRate)
    : adjustedCost;
  const commercial = applyCommercialWaterfall({
    adjustedCost: adjustedCostForWaterfall,
    discount: useMixedCurrencyWaterfall ? 0 : factors.discount,
    packagingAdjustment: factors.embalagem_valor,
    monthlyInterestRate: factors.monthlyInterestRate,
    interestDays: days,
    commissionRate: factors.commission,
    taxRate: factors.taxRate,
    freight: freightType === 'CIF' ? factors.freight : 0,
  });
  const toSourceCurrency = (value: number) =>
    useMixedCurrencyWaterfall ? roundMoney(value / exchangeRate) : value;
  const basePrice = toSourceCurrency(commercial.basePrice);
  const interestValue = toSourceCurrency(commercial.interestValue);
  const taxValue = toSourceCurrency(commercial.taxValue);
  const commissionValue = toSourceCurrency(commercial.commissionValue);
  const freightValue = toSourceCurrency(commercial.freightValue);
  const finalPrice = toSourceCurrency(commercial.finalPrice);
  const totalSaleValue = roundMoney(finalPrice * numberOrZero(factors.totalTons));

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
    basePriceBRL: useMixedCurrencyWaterfall ? commercial.basePrice : convertPriceToBRL(basePrice, currencyContext),
    interestValueBRL: useMixedCurrencyWaterfall ? commercial.interestValue : convertPriceToBRL(interestValue, currencyContext),
    taxValueBRL: useMixedCurrencyWaterfall ? commercial.taxValue : convertPriceToBRL(taxValue, currencyContext),
    commissionValueBRL: useMixedCurrencyWaterfall ? commercial.commissionValue : convertPriceToBRL(commissionValue, currencyContext),
    freightValueBRL: useMixedCurrencyWaterfall ? commercial.freightValue : convertPriceToBRL(freightValue, currencyContext),
    finalPriceBRL: useMixedCurrencyWaterfall ? commercial.finalPrice : convertPriceToBRL(finalPrice, currencyContext),
    totalSaleValueBRL: useMixedCurrencyWaterfall
      ? roundMoney(commercial.finalPrice * numberOrZero(factors.totalTons))
      : convertPriceToBRL(totalSaleValue, currencyContext),
  };
}
