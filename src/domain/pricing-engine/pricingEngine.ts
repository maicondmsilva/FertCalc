import type { PricingFactors, PricingSummary, RawMaterial } from '../../types';

const numberOrZero = (value: unknown): number => Number(value) || 0;

export interface PricingEngineOptions {
  today?: Date;
}

export function calculateMaterialComposition(
  macros: RawMaterial[],
  micros: RawMaterial[]
) {
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
        (micronutrients[guarantee.name] || 0) +
        quantity * (numberOrZero(guarantee.value) / 100);
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
  today: Date
): number {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const start = exemptCurrentMonth
    ? new Date(today.getFullYear(), today.getMonth() + 1, 0)
    : today;
  return Math.max(0, Math.ceil((due.getTime() - start.getTime()) / 86_400_000));
}

export function calculatePricingSummary(
  macros: RawMaterial[],
  micros: RawMaterial[],
  factors: PricingFactors,
  options: PricingEngineOptions = {}
): PricingSummary {
  const composition = calculateMaterialComposition(macros, micros);
  const basePrice = composition.baseCost * (numberOrZero(factors.factor) || 1) - numberOrZero(factors.discount);
  const days = calculateInterestDays(
    factors.dueDate,
    Boolean(factors.exemptCurrentMonth),
    options.today ?? new Date()
  );
  const interestValue = basePrice * ((numberOrZero(factors.monthlyInterestRate) / 30) / 100) * days;
  const taxValue = basePrice * (numberOrZero(factors.taxRate) / 100);
  const commissionValue = basePrice * (numberOrZero(factors.commission) / 100);
  const freightType = factors.tipoFrete ?? (numberOrZero(factors.freight) > 0 ? 'CIF' : 'FOB');
  const freightValue = freightType === 'CIF' ? numberOrZero(factors.freight) : 0;
  const finalPrice =
    basePrice +
    interestValue +
    taxValue +
    commissionValue +
    freightValue +
    numberOrZero(factors.embalagem_valor);

  return {
    ...composition,
    basePrice,
    interestValue,
    taxValue,
    commissionValue,
    freightValue,
    finalPrice,
    totalSaleValue: finalPrice * numberOrZero(factors.totalTons),
  };
}
