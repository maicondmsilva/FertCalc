import type {
  CompatibilityCategory,
  IncompatibilityRule,
  RawMaterial,
  TargetFormula,
} from '../types';
import {
  calculateTargetFormula,
  parseFormulaTarget,
  type CalculationIssue,
} from '../domain/pricing-engine';
import { buildGuaranteeComparisons } from './guaranteeComparison';

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

export interface FormulaComparisonAlternative {
  categoryId: string;
  categoryName: string;
  feasible: boolean;
  calculation: TargetFormula;
  issue?: CalculationIssue;
  issueMessage?: string;
  deviationScore: number;
}

interface BuildFormulaComparisonAlternativesInput {
  sourceCalculation: TargetFormula;
  availableMacros: RawMaterial[];
  availableMicros: RawMaterial[];
  categories: CompatibilityCategory[];
  selectedCategoryIds: string[];
  reductions: { n: number; p: number; k: number };
  incompatibilityRules: IncompatibilityRule[];
}

const describeIssue = (issue?: CalculationIssue): string | undefined => {
  if (!issue) return undefined;
  if (issue.code === 'MISSING_MICRO_TARGET_SOURCE') {
    return `Sem fonte selecionada para ${issue.micronutrients.join(', ')}.`;
  }
  if (issue.code === 'INFEASIBLE_FORMULA') {
    return 'Não fecha com os mínimos, máximos, fixos e incompatibilidades desta categoria.';
  }
  if (issue.code === 'EMPTY_FREE_PRODUCTS') return 'Nenhum produto livre foi informado.';
  return `Produto ${issue.productId} não está disponível para esta comparação.`;
};

export function buildFormulaComparisonAlternatives({
  sourceCalculation,
  availableMacros,
  availableMicros,
  categories,
  selectedCategoryIds,
  reductions,
  incompatibilityRules,
}: BuildFormulaComparisonAlternativesInput): FormulaComparisonAlternative[] {
  const formula = buildReducedComparisonFormula(sourceCalculation, reductions);
  const nutrientTarget = parseFormulaTarget(formula);
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return selectedCategoryIds.map((categoryId) => {
    const category = categoryById.get(categoryId);
    const macros = buildComparisonMaterials({
      available: availableMacros,
      source: sourceCalculation.macros,
      categoryIds: [categoryId],
      includeCategoryCandidates: true,
    });
    const micros = buildComparisonMaterials({
      available: availableMicros,
      source: sourceCalculation.micros,
    });
    const result = calculateTargetFormula({
      calculation: {
        ...sourceCalculation,
        id: `${sourceCalculation.id}-comparison-${categoryId}`,
        formula,
        selected: true,
        modo_calculo: 'formulacao',
        produtos_livres: [],
        macros,
        micros,
      },
      defaultMacros: macros,
      defaultMicros: micros,
      microsInGear: true,
      incompatibilityRules,
    });
    const comparisons = result.calculation.summary
      ? buildGuaranteeComparisons(result.calculation.summary, {
          targetCa: sourceCalculation.targetCa,
          targetS: sourceCalculation.targetS,
          targetMicros: sourceCalculation.targetMicros,
        })
      : [];

    return {
      categoryId,
      categoryName: category?.nome || 'Categoria não identificada',
      feasible: !result.issue && Boolean(result.calculation.summary),
      calculation: result.calculation,
      issue: result.issue,
      issueMessage: describeIssue(result.issue),
      deviationScore:
        comparisons.reduce(
          (total, comparison) => total + Math.abs(comparison.calculated - comparison.target),
          0
        ) +
        (result.calculation.summary && nutrientTarget
          ? Math.abs(result.calculation.summary.resultingN - nutrientTarget.n) +
            Math.abs(result.calculation.summary.resultingP - nutrientTarget.p) +
            Math.abs(result.calculation.summary.resultingK - nutrientTarget.k)
          : 0),
    };
  });
}
