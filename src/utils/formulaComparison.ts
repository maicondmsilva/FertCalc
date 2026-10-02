import type { RawMaterial, TargetFormula } from '../types';

const numeric = (value: unknown): number => Number(value) || 0;

export const isFixedComparisonMaterial = (material: RawMaterial): boolean =>
  numeric(material.minQty) > 0 && numeric(material.minQty) === numeric(material.maxQty);

interface BuildComparisonMaterialsInput {
  available: RawMaterial[];
  source: RawMaterial[];
  categoryIds?: string[];
  includeCategoryCandidates?: boolean;
}

/**
 * Builds a candidate list from the current price-list products while keeping
 * the exact constraints configured in the source formula. Selected and fixed
 * products from the source are never removed by a category filter.
 */
export function buildComparisonMaterials({
  available,
  source,
  categoryIds = [],
  includeCategoryCandidates = false,
}: BuildComparisonMaterialsInput): RawMaterial[] {
  const sourceById = new Map(source.map((material) => [material.id, material]));
  const availableIds = new Set(available.map((material) => material.id));
  const selectedCategories = new Set(categoryIds);
  const merge = (material: RawMaterial): RawMaterial => {
    const sourceMaterial = sourceById.get(material.id);
    const belongsToSelectedCategory =
      includeCategoryCandidates &&
      selectedCategories.size > 0 &&
      (material.categories || []).some((categoryId) => selectedCategories.has(categoryId));
    const mustRemainSelected = Boolean(
      sourceMaterial?.selected || (sourceMaterial && isFixedComparisonMaterial(sourceMaterial))
    );

    return {
      ...material,
      ...(sourceMaterial || {}),
      selected: mustRemainSelected || belongsToSelectedCategory,
    };
  };

  return [
    ...available.map(merge),
    ...source.filter((material) => !availableIds.has(material.id)).map(merge),
  ];
}

export function buildReducedComparisonFormula(
  source: TargetFormula,
  reductions: { n: number; p: number; k: number }
): string {
  const summary = source.summary;
  const n = numeric(summary?.resultingN ?? source.targetN) * (1 - numeric(reductions.n) / 100);
  const p = numeric(summary?.resultingP ?? source.targetP) * (1 - numeric(reductions.p) / 100);
  const k = numeric(summary?.resultingK ?? source.targetK) * (1 - numeric(reductions.k) / 100);
  return `${Math.max(0, n).toFixed(2)}-${Math.max(0, p).toFixed(2)}-${Math.max(0, k).toFixed(2)}`;
}

export function calculateComparisonDose(
  sourceDose: number,
  targetNutrientsPerHectare: { n: number; p: number; k: number },
  resultingFormula: { n: number; p: number; k: number }
): number {
  const candidates = [
    [targetNutrientsPerHectare.p, resultingFormula.p],
    [targetNutrientsPerHectare.n, resultingFormula.n],
    [targetNutrientsPerHectare.k, resultingFormula.k],
  ];
  const reference = candidates.find(([target, guarantee]) => target > 0 && guarantee > 0);
  if (!reference) return Math.max(0, numeric(sourceDose));
  return reference[0] / (reference[1] / 100);
}
