import { PricingRecord } from '../types';

export function getPricingTotalTons(pricing: PricingRecord): number {
  if (pricing.calculations && pricing.calculations.length > 0) {
    return pricing.calculations.reduce((sum, calc) => sum + (Number(calc.factors?.totalTons) || 0), 0);
  }
  return Number(pricing.factors?.totalTons) || 0;
}

export function getPricingTotalSaleValue(pricing: PricingRecord): number {
  if (pricing.calculations && pricing.calculations.length > 0) {
    return pricing.calculations.reduce((sum, calc) => sum + (Number(calc.summary?.totalSaleValue) || 0), 0);
  }
  return Number(pricing.summary?.totalSaleValue) || 0;
}

export function getPricingTotalCommission(pricing: PricingRecord): number {
  if (pricing.calculations && pricing.calculations.length > 0) {
    // Calculadora logic (Option B): The commission value per ton is stored in summary.commissionValue.
    // We just need to multiply this per-ton commission by the actual tons of the formula.
    return pricing.calculations.reduce((sum, calc) => {
      const commPerTon = Number(calc.summary?.commissionValue) || 0;
      const tons = Number(calc.factors?.totalTons) || 0;
      return sum + (commPerTon * tons);
    }, 0);
  }
  // Fallback for old records
  const oldCommPerTon = Number(pricing.summary?.commissionValue) || 0;
  const oldTons = Number(pricing.factors?.totalTons) || 0;
  return oldCommPerTon * oldTons;
}

export function getPricingAverageCommissionRate(pricing: PricingRecord): number {
  if (pricing.calculations && pricing.calculations.length > 0 && pricing.calculations[0].factors) {
    // Just pulling from the first calculation factors, as commission % is uniform across the pricing record usually
    return Number(pricing.calculations[0].factors.commission) || 0;
  }
  return Number(pricing.factors?.commission) || 0;
}
