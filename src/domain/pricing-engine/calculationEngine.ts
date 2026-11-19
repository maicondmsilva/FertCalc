import type { IncompatibilityRule, RawMaterial, TargetFormula } from '../../types';
import { applyProdutosLivresToMaterials, getCalculationMode } from '../../utils/calculationMode';
import { formatNPK } from '../../utils/formatters';
import {
  getMissingSelectedMicronutrientSources,
  getSecondaryNutrientTarget,
  isMagnesiumGuarantee,
  isSecondaryNutrientGuarantee,
} from '../../utils/micronutrients';
import { hasFormulaTarget, parseFormulaTarget } from './formulaEngine';
import { approximateFormula } from './formulaApproximationEngine';
import { optimizeFormula } from './optimizationEngine';
import {
  diagnoseFormulaInfeasibility,
  type OptimizationDiagnostic,
} from './optimizationDiagnostics';
import { calculatePricingSummary } from './pricingEngine';

export type CalculationIssue =
  | { code: 'EMPTY_FREE_PRODUCTS' }
  | { code: 'UNKNOWN_FREE_PRODUCT'; productId: string }
  | { code: 'MISSING_MICRO_TARGET_SOURCE'; micronutrients: string[] }
  | { code: 'INFEASIBLE_FORMULA'; formula: string; diagnostics: OptimizationDiagnostic[] };

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

  const targetMg = Number(calculation.targetMg) || 0;
  const micronutrientTargets = Object.fromEntries(
    Object.entries(calculation.targetMicros || {}).filter(
      ([name]) =>
        !isSecondaryNutrientGuarantee(name) && !(targetMg > 0 && isMagnesiumGuarantee(name))
    )
  );
  const missingMicronutrientSources = getMissingSelectedMicronutrientSources(micronutrientTargets, [
    ...currentMacros,
    ...currentMicros,
  ]);
  const optimizationInput = {
    target,
    targetS: calculation.targetS || getSecondaryNutrientTarget(calculation.targetMicros, 's'),
    targetCa: calculation.targetCa || getSecondaryNutrientTarget(calculation.targetMicros, 'ca'),
    targetMg,
    targetMicros: micronutrientTargets,
    macros: currentMacros,
    micros: currentMicros,
    incompatibilityRules,
  };
  const buildApproximation = () => {
    const approximation = approximateFormula(optimizationInput);
    if (!approximation.feasible) return undefined;
    return {
      suggestedFormula: approximation.suggestedFormula,
      macros: approximation.macros,
      micros: approximation.micros,
      summary: calculatePricingSummary(
        approximation.macros,
        approximation.micros,
        calculation.factors
      ),
      deviationScore: approximation.deviationScore,
      targetMicros: approximation.achievedMicroTargets,
    };
  };
  /**
   * A fórmula não fecha: mostra o resultado mais próximo obtido (o mesmo da
   * sugestão, pelo menor custo) e marca a fórmula como "não fecha". Nunca mantém
   * as quantidades de um cálculo anterior, que seriam de outra fórmula.
   */
  const buildNotClosedCalculation = (): TargetFormula => {
    const approximation = buildApproximation();
    const zeroed = (materials: RawMaterial[]) =>
      materials.map((material) => ({ ...material, quantity: 0 }));
    const macros = approximation ? approximation.macros : zeroed(currentMacros);
    const micros = approximation ? approximation.micros : zeroed(currentMicros);
    return {
      ...calculation,
      macros,
      micros,
      approximation,
      notClosed: true,
      summary: approximation
        ? approximation.summary
        : calculatePricingSummary(macros, micros, calculation.factors),
    };
  };

  if (missingMicronutrientSources.length > 0) {
    return {
      calculation: buildNotClosedCalculation(),
      issue: {
        code: 'MISSING_MICRO_TARGET_SOURCE',
        micronutrients: missingMicronutrientSources,
      },
    };
  }

  const optimization = optimizeFormula(optimizationInput);
  if (!optimization.feasible) {
    return {
      calculation: buildNotClosedCalculation(),
      issue: {
        code: 'INFEASIBLE_FORMULA',
        formula: calculation.formula,
        diagnostics: diagnoseFormulaInfeasibility(optimizationInput),
      },
    };
  }

  return {
    calculation: {
      ...calculation,
      approximation: undefined,
      notClosed: undefined,
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
