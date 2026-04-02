interface RentabilityInput {
  unitaryPrice: number;
  factor: number;
  baseCost: number;
  freightDeduction: number;
  commissionRate: number;
  interestRate: number;      // monthlyInterestRate em %
  taxRate: number;
  dueDate?: string;          // data de vencimento (ISO date string)
  exemptCurrentMonth?: boolean; // isentar juros no mês atual
}

export function calcRentability(input: RentabilityInput): {
  baseCostAfterFactor: number;
  commissionDeduction: number;
  interestDeduction: number;
  taxDeduction: number;
  netRevenue: number;
  profitability: number;
  profitabilityPercent: number;
  daysOfInterest: number;
} {
  const { unitaryPrice, factor, baseCost, freightDeduction, commissionRate, interestRate, taxRate, dueDate, exemptCurrentMonth } = input;

  const baseCostAfterFactor = baseCost * factor;

  // Cálculo de dias baseado em data de vencimento (igual ao Calculator.tsx)
  let days = 0;
  if (dueDate) {
    const due = new Date(dueDate);
    const today = new Date();

    if (exemptCurrentMonth) {
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      if (due > endOfMonth) {
        const diffTime = due.getTime() - endOfMonth.getTime();
        days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    } else {
      const diffTime = due.getTime() - today.getTime();
      days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    if (days < 0) days = 0;
  }

  // Juros compostos mensais sobre (unitaryPrice - freightDeduction)
  // Modelo de dedução: Saldo(m+1) = Saldo(m) × (1 - taxaMensal/100)
  // jurosTotal = Saldo(0) × (1 − (1 − taxaMensal/100)^(dias/30))
  const interestBase = unitaryPrice - freightDeduction;
  const monthFraction = days / 30;
  const interestDeduction = days > 0 && (interestRate || 0) > 0
    ? interestBase * (1 - Math.pow(1 - (interestRate || 0) / 100, monthFraction))
    : 0;

  const taxDeduction = unitaryPrice * (taxRate / 100);
  const commissionDeduction = unitaryPrice * (commissionRate / 100);

  const netRevenue = unitaryPrice - taxDeduction - freightDeduction - commissionDeduction - interestDeduction;

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
    daysOfInterest: days,
  };
}
