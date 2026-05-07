import { RawMaterial, TargetFormula } from '../types';

export const DEFAULT_CALCULATION_MODE = 'formulacao';

export type CalculationMode = 'formulacao' | 'produtos_livres';

export const getCalculationMode = (calc: TargetFormula): CalculationMode =>
  calc.modo_calculo === 'produtos_livres' ? 'produtos_livres' : DEFAULT_CALCULATION_MODE;

export const resetMaterialsForMode = (materials: RawMaterial[]) =>
  materials.map((material) => ({
    ...material,
    selected: false,
    quantity: 0,
  }));

export const applyProdutosLivresToMaterials = (
  products: Array<{ productId: string; quantity: number }>,
  availableMacros: RawMaterial[],
  availableMicros: RawMaterial[]
) => {
  const quantityByProduct = products.reduce<Record<string, number>>((acc, item) => {
    acc[item.productId] = Number(item.quantity || 0);
    return acc;
  }, {});

  const nextMacros = availableMacros.map((material) => {
    const quantity = quantityByProduct[material.id] || 0;
    return {
      ...material,
      selected: quantity > 0,
      quantity,
      minQty: quantity > 0 ? quantity : material.minQty,
      maxQty: quantity > 0 ? quantity : material.maxQty,
    };
  });

  const nextMicros = availableMicros.map((material) => {
    const quantity = quantityByProduct[material.id] || 0;
    return {
      ...material,
      selected: quantity > 0,
      quantity,
      minQty: quantity > 0 ? quantity : material.minQty,
      maxQty: quantity > 0 ? quantity : material.maxQty,
    };
  });

  return { nextMacros, nextMicros };
};
