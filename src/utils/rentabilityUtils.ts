import { ProfitabilityInput, ProfitabilityResult } from '../types';

export function calculateProfitability(input: ProfitabilityInput): ProfitabilityResult {
  const {
    unitaryPrice,
    factor,
    baseCost,
    freightDeduction,
    commissionRate,
    monthlyInterestRate,
    taxRate,
    dueDate,
    exemptCurrentMonth,
  } = input;

  // custoPósFator = baseCost × fator
  const costAfterFactor = baseCost * (factor || 1);

  // Calcular dias de juros — lógica idêntica ao Calculator.tsx
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

  // Juros incidem sobre custoPósFator
  const dailyInterest = (monthlyInterestRate || 0) / 30;
  const interestDeduction = costAfterFactor * (dailyInterest / 100) * days;

  // Alíquota e comissão incidem sobre unitaryPrice
  const taxDeduction = unitaryPrice * ((taxRate || 0) / 100);
  const commissionDeduction = unitaryPrice * ((commissionRate || 0) / 100);
  const freight = freightDeduction || 0;

  // resultadoLíquido = preçoUnitário - alíquota - frete - comissão - juros
  const netResult = unitaryPrice - taxDeduction - freight - commissionDeduction - interestDeduction;

  // rentabilidade = resultadoLíquido - custoPósFator
  const profitability = netResult - costAfterFactor;

  return {
    unitaryPrice,
    baseCost,
    costAfterFactor,
    freightDeduction: freight,
    commissionDeduction,
    interestDeduction,
    taxDeduction,
    netResult,
    profitability,
    daysOfInterest: days,
    isProfitable: profitability >= 0,
  };
}
