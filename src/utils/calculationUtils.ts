// src/utils/calculationUtils.ts
import { RawMaterial } from '../types';
export { calculatePricingSummary as calculateSummary } from '../domain/pricing-engine';

/**
 * calculateSummary — compatível com as chamadas em Calculator.tsx
 * Recebe arrays de macros e micros (com campo `quantity`, `price`, `n`, `p`, `k`, `s`, `ca`, `microGuarantees`)
 * e os fatores de precificação, e retorna um PricingSummary.
 */
/**
 * buildSolverModel — helper mínimo para montar o model que o solver espera.
 * A implementação no componente principal é mais completa; use/ajuste conforme necessidade.
 */
export function buildSolverModel(
  constraints: Record<string, Record<string, number>> = {},
  variables: Record<string, Record<string, number>> = {},
  objectiveKey = 'cost'
): Record<string, unknown> {
  return {
    optimize: objectiveKey,
    opType: 'min',
    constraints: constraints,
    variables: variables,
    ints: {},
  };
}

/**
 * applyResultsToMaterials — mapeia resultados (obj with ids->values) para a lista de materiais.
 * Atualiza `quantity` do material com o valor retornado pelo solver (ou 0).
 */
export function applyResultsToMaterials(
  results: Record<string, number>,
  materials: RawMaterial[]
): RawMaterial[] {
  return materials.map((mat) => {
    const qty = Number(results?.[mat.id] || 0);
    return { ...mat, quantity: qty };
  });
}
