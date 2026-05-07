import { RawMaterial, TargetFormula } from '../types';

export const DEFAULT_CALCULATION_MODE = 'formulacao';

export type CalculationMode = 'formulacao' | 'produtos_livres';
export type ProdutoLivre = { productId: string; quantity: number };

export const getCalculationMode = (calc: TargetFormula): CalculationMode =>
  calc.modo_calculo === 'produtos_livres' ? 'produtos_livres' : DEFAULT_CALCULATION_MODE;

export const resetMaterialsForMode = (materials: RawMaterial[]) =>
  materials.map((material) => ({
    ...material,
    selected: false,
    quantity: 0,
  }));

export const applyProdutosLivresToMaterials = (
  products: ProdutoLivre[],
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

export const applyCalculationModeChange = (
  calc: TargetFormula,
  mode: CalculationMode,
  availableMacros: RawMaterial[],
  availableMicros: RawMaterial[]
) => {
  if (getCalculationMode(calc) === mode) return calc;
  return {
    ...calc,
    formula: '',
    macros: resetMaterialsForMode(availableMacros),
    micros: resetMaterialsForMode(availableMicros),
    modo_calculo: mode,
    produtos_livres: [],
  };
};

export const isProdutoLivreAvailable = (
  productId: string,
  materials: RawMaterial[],
  products: ProdutoLivre[]
) =>
  materials.some((material) => material.id === productId) &&
  !products.some((p) => p.productId === productId);

export const addProdutoLivre = (products: ProdutoLivre[], productId: string): ProdutoLivre[] => {
  if (products.some((item) => item.productId === productId)) return products;
  return [...products, { productId, quantity: 0 }];
};

export const updateProdutoLivre = (
  products: ProdutoLivre[],
  productId: string,
  quantity: number
): ProdutoLivre[] =>
  products.map((item) =>
    item.productId === productId ? { ...item, quantity: Number(quantity || 0) } : item
  );

export const removeProdutoLivre = (products: ProdutoLivre[], productId: string): ProdutoLivre[] =>
  products.filter((item) => item.productId !== productId);
