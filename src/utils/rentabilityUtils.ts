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

  // Taxa diária usando base de 30 dias/mês (regra de negócio padrão, igual ao Calculator.tsx)
  const dailyInterest = (interestRate || 0) / 30;
  const interestDeduction = baseCostAfterFactor * (dailyInterest / 100) * days;

  const commissionDeduction = unitaryPrice * (commissionRate / 100);
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
    daysOfInterest: days,
  };
}
