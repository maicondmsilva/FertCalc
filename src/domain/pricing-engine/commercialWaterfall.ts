const numeric = (value: unknown): number => Number(value) || 0;

export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export interface CommercialWaterfallInput {
  adjustedCost: number;
  discount?: number;
  packagingAdjustment?: number;
  monthlyInterestRate?: number;
  interestDays?: number;
  commissionRate?: number;
  taxRate?: number;
  freight?: number;
}

export interface CommercialWaterfallResult {
  basePrice: number;
  interestPeriods: number;
  interestValue: number;
  priceAfterInterest: number;
  commissionValue: number;
  priceAfterCommission: number;
  taxValue: number;
  priceAfterTax: number;
  freightValue: number;
  finalPrice: number;
}

/**
 * Aplica a cascata comercial na ordem definida pelo negócio:
 * custo ajustado -> desconto -> embalagem -> juros compostos -> comissão -> imposto -> frete.
 */
export function applyCommercialWaterfall(
  input: CommercialWaterfallInput
): CommercialWaterfallResult {
  const basePrice = roundMoney(
    numeric(input.adjustedCost) - numeric(input.discount) + numeric(input.packagingAdjustment)
  );
  const interestPeriods = Math.max(0, numeric(input.interestDays) / 30);
  const monthlyInterestRate = Math.max(0, numeric(input.monthlyInterestRate)) / 100;
  const priceAfterInterest = roundMoney(
    basePrice * Math.pow(1 + monthlyInterestRate, interestPeriods)
  );
  const interestValue = roundMoney(priceAfterInterest - basePrice);
  const commissionValue = roundMoney(
    priceAfterInterest * (Math.max(0, numeric(input.commissionRate)) / 100)
  );
  const priceAfterCommission = roundMoney(priceAfterInterest + commissionValue);
  const taxValue = roundMoney(priceAfterCommission * (Math.max(0, numeric(input.taxRate)) / 100));
  const priceAfterTax = roundMoney(priceAfterCommission + taxValue);
  const freightValue = roundMoney(numeric(input.freight));
  const finalPrice = roundMoney(priceAfterTax + freightValue);

  return {
    basePrice,
    interestPeriods,
    interestValue,
    priceAfterInterest,
    commissionValue,
    priceAfterCommission,
    taxValue,
    priceAfterTax,
    freightValue,
    finalPrice,
  };
}
