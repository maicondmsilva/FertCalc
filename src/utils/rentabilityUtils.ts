interface RentabilityInput {
  unitaryPrice: number;
  factor: number;
  baseCost: number;
  freightDeduction: number;
  commissionRate: number;
  interestRate: number;
  taxRate: number;
}

export function calcRentability(input: RentabilityInput): {
  baseCostAfterFactor: number;
  commissionDeduction: number;
  interestDeduction: number;
  taxDeduction: number;
  netRevenue: number;
  profitability: number;
  profitabilityPercent: number;
} {
  const { unitaryPrice, factor, baseCost, freightDeduction, commissionRate, interestRate, taxRate } = input;

  const baseCostAfterFactor = baseCost * factor;

  const commissionDeduction = unitaryPrice * (commissionRate / 100);
  const interestDeduction = unitaryPrice * (interestRate / 100);
  const taxDeduction = unitaryPrice * (taxRate / 100);

  const netRevenue = unitaryPrice - freightDeduction - commissionDeduction - interestDeduction - taxDeduction;

  const profitability = netRevenue - baseCostAfterFactor;

  const profitabilityPercent = baseCostAfterFactor > 0 ? (profitability / baseCostAfterFactor) * 100 : 0;

  return {
    baseCostAfterFactor,
    commissionDeduction,
    interestDeduction,
    taxDeduction,
    netRevenue,
    profitability,
    profitabilityPercent,
  };
}
