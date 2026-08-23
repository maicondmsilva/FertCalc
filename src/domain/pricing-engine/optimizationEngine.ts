import solver from 'javascript-lp-solver';
import type { IncompatibilityRule, RawMaterial } from '../../types';
import type { FormulaTarget } from './formulaEngine';

type Constraint = Record<string, number>;
type Variable = Record<string, number>;

export interface OptimizationModel {
  optimize: 'cost';
  opType: 'min';
  constraints: Record<string, Constraint>;
  variables: Record<string, Variable>;
  ints: Record<string, number>;
}

export interface FormulaOptimizationInput {
  target: FormulaTarget;
  targetS?: number;
  targetCa?: number;
  macros: RawMaterial[];
  micros: RawMaterial[];
  incompatibilityRules: IncompatibilityRule[];
}

export interface FormulaOptimizationResult {
  feasible: boolean;
  macros: RawMaterial[];
  micros: RawMaterial[];
  values: Record<string, number>;
}

const numeric = (value: unknown): number => Number(value) || 0;

export function buildFormulaOptimizationModel({
  target,
  targetS = 0,
  targetCa = 0,
  macros,
  micros,
  incompatibilityRules,
}: FormulaOptimizationInput): OptimizationModel {
  const model: OptimizationModel = {
    optimize: 'cost',
    opType: 'min',
    constraints: {
      n_eq: { min: target.n * 10, max: target.n * 10 + 9 },
      p_eq: { min: target.p * 10, max: target.p * 10 + 9 },
      k_eq: { min: target.k * 10, max: target.k * 10 + 9 },
      ...(targetS > 0 ? { s_eq: { min: targetS * 10, max: targetS * 10 + 9 } } : {}),
      ...(targetCa > 0 ? { ca_eq: { min: targetCa * 10, max: targetCa * 10 + 9 } } : {}),
      weight: { equal: 1000 },
    },
    variables: {},
    ints: {},
  };

  const availableMaterials = [...macros, ...micros].filter((material) => material.selected);
  availableMaterials.forEach((material) => {
    const useVariable = `use_${material.id}`;
    const minimumLink = `link_min_${material.id}`;
    const maximumLink = `link_max_${material.id}`;
    const minimumQuantity = numeric(material.minQty);
    model.variables[material.id] = {
      cost: numeric(material.price),
      ...(numeric(material.n) !== 0 ? { n_eq: numeric(material.n) / 100 } : {}),
      ...(numeric(material.p) !== 0 ? { p_eq: numeric(material.p) / 100 } : {}),
      ...(numeric(material.k) !== 0 ? { k_eq: numeric(material.k) / 100 } : {}),
      ...(targetS > 0 && numeric(material.s) !== 0 ? { s_eq: numeric(material.s) / 100 } : {}),
      ...(targetCa > 0 && numeric(material.ca) !== 0 ? { ca_eq: numeric(material.ca) / 100 } : {}),
      weight: 1,
      ...(minimumQuantity > 0 ? { [minimumLink]: 1 } : {}),
      [maximumLink]: 1,
    };
    model.variables[useVariable] = {
      cost: 0.01,
      ...(minimumQuantity > 0 ? { [minimumLink]: -minimumQuantity } : {}),
      [maximumLink]: -(numeric(material.maxQty) || 1000),
    };
    model.ints[useVariable] = 1;
    if (minimumQuantity > 0) model.constraints[minimumLink] = { min: 0 };
    model.constraints[maximumLink] = { max: 0 };

    if (numeric(material.minQty) === numeric(material.maxQty) && numeric(material.minQty) > 0) {
      model.constraints[`force_${material.id}`] = { equal: numeric(material.minQty) };
      model.variables[material.id][`force_${material.id}`] = 1;
    }
  });

  incompatibilityRules.forEach((rule, index) => {
    if (
      availableMaterials.some((material) => material.id === rule.materialAId) &&
      availableMaterials.some((material) => material.id === rule.materialBId)
    ) {
      const constraint = `incomp_${index}`;
      model.constraints[constraint] = { max: 1 };
      model.variables[`use_${rule.materialAId}`][constraint] = 1;
      model.variables[`use_${rule.materialBId}`][constraint] = 1;
    }
  });

  return model;
}

export function optimizeFormula(input: FormulaOptimizationInput): FormulaOptimizationResult {
  const model = buildFormulaOptimizationModel(input);
  const rawResult = solver.Solve(
    model as unknown as Parameters<typeof solver.Solve>[0]
  ) as unknown as Record<string, number | boolean>;
  const feasible = Boolean(rawResult.feasible);
  const values = Object.fromEntries(
    Object.entries(rawResult).filter((entry): entry is [string, number] => typeof entry[1] === 'number')
  );
  const apply = (materials: RawMaterial[]) =>
    materials.map((material) => ({
      ...material,
      quantity: material.selected && feasible ? values[material.id] || 0 : 0,
    }));

  return { feasible, values, macros: apply(input.macros), micros: apply(input.micros) };
}
