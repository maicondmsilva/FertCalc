// src/utils/calculationUtils.ts
import { RawMaterial, PricingFactors, PricingSummary } from '../types';

/**
 * calculateSummary — compatível com as chamadas em Calculator.tsx
 * Recebe arrays de macros e micros (com campo `quantity`, `price`, `n`, `p`, `k`, `s`, `ca`, `microGuarantees`)
 * e os fatores de precificação, e retorna um PricingSummary.
 */
export function calculateSummary(
  currentMacros: RawMaterial[],
  currentMicros: RawMaterial[],
  factors: PricingFactors
): PricingSummary {
  const selectedMacros = currentMacros.filter((m) => m.selected);
  const selectedMicros = currentMicros.filter((m) => m.selected);
  const allSelected = [...selectedMacros, ...selectedMicros];

  let totalWeight = 0; // unidades coerentes com a aplicação (qty)
  let baseCost = 0;
  let totalN_kg = 0;
  let totalP_kg = 0;
  let totalK_kg = 0;
  let totalS_kg = 0;
  let totalCa_kg = 0;
  const resultingMicros: Record<string, number> = {};

  allSelected.forEach((m) => {
    const qty = Number(m.quantity) || 0;
    totalWeight += qty;
    baseCost += (qty / 1000) * (Number(m.price) || 0);

    totalN_kg += qty * ((Number(m.n) || 0) / 100);
    totalP_kg += qty * ((Number(m.p) || 0) / 100);
    totalK_kg += qty * ((Number(m.k) || 0) / 100);
    totalS_kg += qty * ((Number(m.s) || 0) / 100);
    totalCa_kg += qty * ((Number(m.ca) || 0) / 100);

    if (m.microGuarantees) {
      m.microGuarantees.forEach((g) => {
        const micro_kg = qty * ((Number(g.value) || 0) / 100);
        resultingMicros[g.name] = (resultingMicros[g.name] || 0) + micro_kg;
      });
    }
  });

  // Pricing factor: protect against zero/invalid values
  const factor = Number(factors?.factor || 1);
  const basePrice = factor !== 0 ? baseCost / factor : baseCost;

  // Interest (simple/per-period). Monthly interest is treated as a decimal (e.g. 0.01 = 1%)
  const monthlyInterestRate = Number(factors?.monthlyInterestRate || 0);
  const interestValue = basePrice * monthlyInterestRate;

  // Tax, commission and freight
  const taxValue = basePrice * Number(factors?.taxRate || 0);
  const commissionValue = basePrice * Number(factors?.commission || 0);
  const freightValue = Number(factors?.freight || 0);

  // Discount and margin (applied to basePrice)
  const discount = Number(factors?.discount || 0);
  const margin = Number(factors?.margin || 0);

  const priceAfterDiscount = basePrice * (1 - discount);
  const marginValue = priceAfterDiscount * margin;

  // Final price and sale value (using totalTons as multiplier when present)
  const finalPrice =
    priceAfterDiscount + interestValue + taxValue + commissionValue + freightValue + marginValue;
  const totalSaleValue = finalPrice * Number(factors?.totalTons || 0);

  // Resulting guarantees (%). If totalWeight is zero avoid division by zero.
  const resultingN = totalWeight ? (totalN_kg / totalWeight) * 100 : 0;
  const resultingP = totalWeight ? (totalP_kg / totalWeight) * 100 : 0;
  const resultingK = totalWeight ? (totalK_kg / totalWeight) * 100 : 0;
  const resultingS = totalWeight ? (totalS_kg / totalWeight) * 100 : 0;
  const resultingCa = totalWeight ? (totalCa_kg / totalWeight) * 100 : 0;

  return {
    totalWeight,
    baseCost,
    basePrice,
    interestValue,
    taxValue,
    commissionValue,
    freightValue,
    finalPrice,
    totalSaleValue,
    resultingN,
    resultingP,
    resultingK,
    resultingS,
    resultingCa,
    resultingMicros,
  };
}

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
