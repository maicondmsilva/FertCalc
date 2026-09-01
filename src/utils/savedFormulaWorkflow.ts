import type { PriceList, SavedFormula } from '../types';

export function getPriceListsForLoadingLocation(
  priceLists: PriceList[],
  loadingLocationId: string
): PriceList[] {
  if (!loadingLocationId) return [];
  return priceLists.filter((list) => list.local_carregamento_id === loadingLocationId);
}

export function getFormulaUpdateProtection(
  formula: SavedFormula,
  isDifferentiatedLine: boolean
): { canUpdate: boolean; protectedMaterialIds: string[]; reason?: string } {
  if (isDifferentiatedLine) {
    return {
      canUpdate: false,
      protectedMaterialIds: [...formula.macros, ...formula.micros].map((material) => material.id),
      reason: 'Produtos de linha diferenciada devem manter a composição cadastrada.',
    };
  }

  return {
    canUpdate: true,
    protectedMaterialIds: formula.micros.map((material) => material.id),
    reason:
      formula.micros.length > 0
        ? 'Os micronutrientes serão preservados para manter a descrição da formulação.'
        : undefined,
  };
}
