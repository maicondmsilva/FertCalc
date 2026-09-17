import type { RawMaterial, TargetFormula } from '../types';
import type { PriceListCurrencySnapshot } from './priceListCurrency';

export function resetCalculationForPriceList(
  calculation: TargetFormula,
  macros: RawMaterial[],
  micros: RawMaterial[],
  priceListId: string,
  currencySnapshot: PriceListCurrencySnapshot
): TargetFormula {
  return {
    ...calculation,
    category: 'all',
    produtos_livres: [],
    factors: {
      ...calculation.factors,
      priceListId,
      ...currencySnapshot,
    },
    macros: macros.map((material) => ({ ...material })),
    micros: micros.map((material) => ({ ...material })),
    summary: undefined,
    profitabilityAnalysis: undefined,
  };
}
