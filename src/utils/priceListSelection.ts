import type { RawMaterial, TargetFormula } from '../types';
import type { PriceListCurrencySnapshot } from './priceListCurrency';

export function resetCalculationForPriceList(
  calculation: TargetFormula,
  macros: RawMaterial[],
  micros: RawMaterial[],
  priceListId: string,
  currencySnapshot: PriceListCurrencySnapshot,
  defaultFactor?: number
): TargetFormula {
  return {
    ...calculation,
    category: 'all',
    produtos_livres: [],
    factors: {
      ...calculation.factors,
      priceListId,
      ...currencySnapshot,
      ...(defaultFactor !== undefined ? { factor: defaultFactor } : {}),
    },
    macros: macros.map((material) => ({ ...material })),
    micros: micros.map((material) => ({ ...material })),
    summary: undefined,
    profitabilityAnalysis: undefined,
  };
}
