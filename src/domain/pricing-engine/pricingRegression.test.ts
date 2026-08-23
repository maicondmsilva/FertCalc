import { describe, expect, it } from 'vitest';
import {
  calculatePricingSummary,
  calculateProfitability,
  optimizeFormula,
  parseFormulaTarget,
} from '.';
import { pricingRegressionScenarios } from './regressionScenarios';

describe('cenários de regressão do motor de precificação', () => {
  it.each(pricingRegressionScenarios)('$name', (scenario) => {
    const target = parseFormulaTarget(scenario.factors.targetFormula);
    expect(target).not.toBeNull();

    const optimization = optimizeFormula({
      target: target!,
      macros: scenario.macros,
      micros: [],
      incompatibilityRules: [],
    });
    expect(optimization.feasible).toBe(true);

    const summary = calculatePricingSummary(
      optimization.macros,
      optimization.micros,
      scenario.factors,
      { today: scenario.calculationDate }
    );

    Object.entries(scenario.expected).forEach(([field, expected]) => {
      expect(summary[field as keyof typeof scenario.expected], field).toBeCloseTo(expected, 6);
    });
  });

  it('mantém a rentabilidade determinística para o cenário CIF de referência', () => {
    const scenario = pricingRegressionScenarios[0];
    const summary = calculatePricingSummary(scenario.macros, [], scenario.factors, {
      today: scenario.calculationDate,
    });
    const result = calculateProfitability(
      {
        unitaryPrice: summary.finalPrice,
        factor: scenario.factors.factor,
        baseCost: summary.baseCost,
        freightDeduction: summary.freightValue,
        commissionRate: scenario.factors.commission,
        interestRate: scenario.factors.monthlyInterestRate,
        taxRate: scenario.factors.taxRate,
        dueDate: scenario.dueDate,
        exemptCurrentMonth: scenario.factors.exemptCurrentMonth,
        packagingValue: scenario.factors.embalagem_valor,
      },
      { today: scenario.calculationDate }
    );

    expect(result.daysOfInterest).toBe(30);
    expect(result.baseCostAfterFactor).toBeCloseTo(1911, 6);
    expect(result.netRevenue).toBeCloseTo(1849.391525, 6);
    expect(result.profitability).toBeCloseTo(-61.608475, 6);
    expect(result.profitabilityPercent).toBeCloseTo(-3.2238867085, 6);
  });
});
