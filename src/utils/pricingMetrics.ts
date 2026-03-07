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
    return pricing.calculations.reduce((sum, calc) => sum + (Number(calc.summary?.commissionValue) || 0), 0);
  }
  return Number(pricing.summary?.commissionValue) || 0;
}
