import solver from 'javascript-lp-solver';
import type { RawMaterial } from '../../types';
import {
  getCalculatedMicronutrientValue,
  isMagnesiumGuarantee,
  isSecondaryNutrientGuarantee,
  normalizeMicronutrientKey,
} from '../../utils/micronutrients';
import { formatNPK } from '../../utils/formatters';
import {
  buildFormulaOptimizationModel,
  distanceOutsideGuaranteeRange,
  NPK_UPPER_TOLERANCE,
  SECONDARY_UPPER_TOLERANCE,
  type FormulaOptimizationInput,
  type OptimizationModel,
} from './optimizationEngine';
import { calculateMaterialComposition } from './pricingEngine';

export interface FormulaApproximationResult {
  feasible: boolean;
  macros: RawMaterial[];
  micros: RawMaterial[];
  suggestedFormula: string;
  deviationScore: number;
  composition: ReturnType<typeof calculateMaterialComposition>;
  achievedMicroTargets: Record<string, number>;
}

interface RelaxedTarget {
  constraint: string;
  value: number;
}

const numeric = (value: unknown): number => Number(value) || 0;

const normalizedMicroTargets = (targets: Record<string, number> = {}, excludeMagnesium = false) => {
  const normalized = new Map<string, { name: string; value: number }>();
  Object.entries(targets)
    .filter(
      ([name, value]) =>
        name.trim().length > 0 &&
        numeric(value) > 0 &&
        !isSecondaryNutrientGuarantee(name) &&
        !(excludeMagnesium && isMagnesiumGuarantee(name))
    )
    .forEach(([name, value]) => {
      const key = normalizeMicronutrientKey(name);
      const current = normalized.get(key);
      normalized.set(key, { name, value: Math.max(current?.value || 0, numeric(value)) });
    });
  return Array.from(normalized.values());
};

const solve = (model: OptimizationModel) =>
  solver.Solve(model as unknown as Parameters<typeof solver.Solve>[0]) as unknown as Record<
    string,
    number | boolean
  >;

const cloneModel = (model: OptimizationModel): OptimizationModel =>
  JSON.parse(JSON.stringify(model)) as OptimizationModel;

export function approximateFormula(input: FormulaOptimizationInput): FormulaApproximationResult {
  const model = buildFormulaOptimizationModel(input);
  const targetMg = numeric(input.targetMg);
  const microTargets = normalizedMicroTargets(input.targetMicros, targetMg > 0);
  const relaxedTargets: RelaxedTarget[] = [
    { constraint: 'n_eq', value: input.target.n * 10 },
    { constraint: 'p_eq', value: input.target.p * 10 },
    { constraint: 'k_eq', value: input.target.k * 10 },
    ...(numeric(input.targetS) > 0
      ? [{ constraint: 's_eq', value: numeric(input.targetS) * 10 }]
      : []),
    ...(numeric(input.targetCa) > 0
      ? [{ constraint: 'ca_eq', value: numeric(input.targetCa) * 10 }]
      : []),
    ...(targetMg > 0 ? [{ constraint: 'mg_eq', value: targetMg * 10 }] : []),
    ...microTargets.map(({ value }, index) => ({
      constraint: `micro_target_${index}`,
      value: value * 10,
    })),
  ];

  // Mantém as faixas do otimizador (alvo até +0,99) e só mede o que ficar fora
  // delas: dentro da faixa não há desvio, e o custo decide a composição.
  relaxedTargets.forEach(({ constraint }, index) => {
    const under = `approx_under_${index}`;
    const over = `approx_over_${index}`;
    model.variables[under] = { deviation: 1, [constraint]: 1, cost: 0 };
    model.variables[over] = { deviation: 1, [constraint]: -1, cost: 0 };
  });
  Object.values(model.variables).forEach((variable) => {
    if (!('deviation' in variable)) variable.deviation = 0;
  });
  model.optimize = 'deviation';

  const deviationResult = solve(model);
  if (!deviationResult.feasible) {
    return {
      feasible: false,
      macros: input.macros,
      micros: input.micros,
      suggestedFormula: '',
      deviationScore: Number.POSITIVE_INFINITY,
      composition: calculateMaterialComposition(input.macros, input.micros),
      achievedMicroTargets: {},
    };
  }

  const bestDeviation = numeric(deviationResult.result);
  const costModel = cloneModel(model);
  costModel.constraints.approx_total_deviation = { max: bestDeviation + 1e-6 };
  Object.entries(costModel.variables).forEach(([name, variable]) => {
    variable.approx_total_deviation = name.startsWith('approx_') ? 1 : 0;
  });
  costModel.optimize = 'cost';
  const costResult = solve(costModel);
  const result = costResult.feasible ? costResult : deviationResult;
  const apply = (materials: RawMaterial[]) =>
    materials.map((material) => ({
      ...material,
      quantity: material.selected ? numeric(result[material.id]) : 0,
    }));
  const macros = apply(input.macros);
  const micros = apply(input.micros);
  const composition = calculateMaterialComposition(macros, micros);
  const achievedMicroTargets = Object.fromEntries(
    microTargets.map(({ name }) => [
      name,
      numeric(getCalculatedMicronutrientValue(composition.resultingMicros, name)),
    ])
  );
  const npkOutside = (target: number, obtained: number) =>
    distanceOutsideGuaranteeRange(target, obtained, NPK_UPPER_TOLERANCE);
  const secondaryOutside = (target: number, obtained: number) =>
    target > 0 ? distanceOutsideGuaranteeRange(target, obtained, SECONDARY_UPPER_TOLERANCE) : 0;
  const deviationScore =
    npkOutside(input.target.n, composition.resultingN) +
    npkOutside(input.target.p, composition.resultingP) +
    npkOutside(input.target.k, composition.resultingK) +
    secondaryOutside(numeric(input.targetCa), composition.resultingCa) +
    secondaryOutside(numeric(input.targetS), composition.resultingS) +
    secondaryOutside(targetMg, composition.resultingMg) +
    microTargets.reduce(
      (total, { name, value }) => total + Math.max(0, value - numeric(achievedMicroTargets[name])),
      0
    );

  return {
    feasible: true,
    macros,
    micros,
    suggestedFormula: formatNPK(
      `${input.target.n}-${input.target.p}-${input.target.k}`,
      composition.resultingN,
      composition.resultingP,
      composition.resultingK
    ),
    deviationScore,
    composition,
    achievedMicroTargets,
  };
}
