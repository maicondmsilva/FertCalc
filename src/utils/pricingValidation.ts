import type { Agent, TargetFormula } from '../types';
import { hasValidPricingExchangeRate } from './priceListCurrency';

export interface PricingSaveValidation {
  valid: boolean;
  message?: string;
}

export function validatePricingForSave(
  calculations: TargetFormula[],
  agent?: Agent | null
): PricingSaveValidation {
  const selectedCalculations = calculations.filter((calculation) => calculation.selected);

  if (selectedCalculations.length === 0) {
    return {
      valid: false,
      message: 'Selecione pelo menos uma fórmula para salvar a precificação.',
    };
  }

  const formulaWithoutExchangeRate = selectedCalculations.find(
    (calculation) => !hasValidPricingExchangeRate(calculation.factors)
  );
  if (formulaWithoutExchangeRate) {
    return {
      valid: false,
      message: `Informe um câmbio válido para calcular e salvar a fórmula "${formulaWithoutExchangeRate.formula || 'sem nome'}".`,
    };
  }

  const formulaWithoutTons = selectedCalculations.find(
    (calculation) =>
      !Number.isFinite(Number(calculation.factors?.totalTons)) ||
      Number(calculation.factors?.totalTons) <= 0
  );
  if (formulaWithoutTons) {
    return {
      valid: false,
      message: `Informe uma quantidade de toneladas maior que zero para a fórmula "${formulaWithoutTons.formula || 'sem nome'}".`,
    };
  }

  const hasCommission = selectedCalculations.some(
    (calculation) => Number(calculation.factors?.commission) > 0
  );
  if (hasCommission && !agent?.id) {
    return {
      valid: false,
      message: 'Selecione um agente antes de aplicar comissão.',
    };
  }

  return { valid: true };
}
