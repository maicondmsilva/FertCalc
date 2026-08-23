import type { IncompatibilityRule, RawMaterial, TargetFormula } from '../../types';
import { applyProdutosLivresToMaterials, getCalculationMode } from '../../utils/calculationMode';
import { formatNPK } from '../../utils/formatters';
import { hasFormulaTarget, parseFormulaTarget } from './formulaEngine';
import { optimizeFormula } from './optimizationEngine';
import { calculatePricingSummary } from './pricingEngine';

export type CalculationIssue =
  | { code: 'EMPTY_FREE_PRODUCTS' }
  | { code: 'UNKNOWN_FREE_PRODUCT'; productId: string }
  | { code: 'INFEASIBLE_FORMULA'; formula: string };

export interface CalculateTargetFormulaInput {
  calculation: TargetFormula;
  defaultMacros: RawMaterial[];
  defaultMicros: RawMaterial[];
  microsInGear: boolean;
  incompatibilityRules: IncompatibilityRule[];
}

export interface CalculateTargetFormulaResult {
  calculation: TargetFormula;
  issue?: CalculationIssue;
}

export function applyFreeCompositionSummary(
  calculation: TargetFormula,
  macros: RawMaterial[],
  micros: RawMaterial[]
): TargetFormula {
  const applyQuantity = (material: RawMaterial): RawMaterial => ({
    ...material,
    quantity: material.selected ? Number(material.minQty || material.quantity || 0) : 0,
  });
  const nextMacros = macros.map(applyQuantity);
  const nextMicros = micros.map(applyQuantity);

  return {
    ...calculation,
    macros: nextMacros,
    micros: nextMicros,
    summary: calculatePricingSummary(nextMacros, nextMicros, calculation.factors),
  };
}

export function calculateTargetFormula({
  calculation,
  defaultMacros,
  defaultMicros,
  microsInGear,
  incompatibilityRules,
}: CalculateTargetFormulaInput): CalculateTargetFormulaResult {
  const currentMacros = calculation.macros?.length ? calculation.macros : defaultMacros;
  const currentMicros = microsInGear
    ? calculation.micros?.length
      ? calculation.micros
      : defaultMicros
    : defaultMicros;

  if (getCalculationMode(calculation) === 'produtos_livres') {
    const products = (calculation.produtos_livres || []).filter(
      (item) => Number(item.quantity) > 0
    );
    if (products.length === 0) {
      return { calculation, issue: { code: 'EMPTY_FREE_PRODUCTS' } };
    }

    const unknownProduct = products.find(
      (item) => ![...currentMacros, ...currentMicros].some(({ id }) => id === item.productId)
    );
    if (unknownProduct) {
      return {
        calculation,
        issue: { code: 'UNKNOWN_FREE_PRODUCT', productId: unknownProduct.productId },
      };
    }

    const { nextMacros, nextMicros } = applyProdutosLivresToMaterials(
      products,
      currentMacros,
      currentMicros
    );
    const summary = calculatePricingSummary(nextMacros, nextMicros, calculation.factors);
    return {
      calculation: {
        ...calculation,
        formula: formatNPK(
          calculation.formula || '0-0-0',
          summary.resultingN,
          summary.resultingP,
          summary.resultingK
        ),
        macros: nextMacros,
        micros: nextMicros,
        summary,
      },
    };
  }

  if (!hasFormulaTarget(calculation.formula)) {
    return {
      calculation: applyFreeCompositionSummary(calculation, currentMacros, currentMicros),
    };
  }

  const target = parseFormulaTarget(calculation.formula);
  if (!target) return { calculation };

  const optimization = optimizeFormula({
    target,
    targetS: calculation.targetS,
    targetCa: calculation.targetCa,
    macros: currentMacros,
    micros: currentMicros,
    incompatibilityRules,
  });
  if (!optimization.feasible) {
    return {
      calculation: {
        ...calculation,
        summary: calculatePricingSummary(
          calculation.macros,
          calculation.micros,
          calculation.factors
        ),
      },
      issue: { code: 'INFEASIBLE_FORMULA', formula: calculation.formula },
    };
  }

  return {
    calculation: {
      ...calculation,
      macros: optimization.macros,
      micros: optimization.micros,
      summary: calculatePricingSummary(
        optimization.macros,
        optimization.micros,
        calculation.factors
      ),
    },
  };
}
