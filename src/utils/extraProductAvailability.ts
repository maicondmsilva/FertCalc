import type { MacroMaterial, MicroMaterial } from '../types';

type ExtraProduct = Pick<
  MacroMaterial | MicroMaterial,
  'availableInCalculatorWithoutPriceList' | 'extraLoadingLocationIds'
>;

export function isExtraProductAvailableAtLocation(
  product: ExtraProduct,
  loadingLocationId?: string
): boolean {
  if (!product.availableInCalculatorWithoutPriceList) return false;

  // Compatibilidade temporária caso o app seja publicado antes da migration.
  if (product.extraLoadingLocationIds === undefined) return true;

  return Boolean(loadingLocationId && product.extraLoadingLocationIds.includes(loadingLocationId));
}
