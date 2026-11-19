import solver from 'javascript-lp-solver';
import type { IncompatibilityRule, RawMaterial } from '../../types';
import type { FormulaTarget } from './formulaEngine';
import { calculateMaterialComposition } from './pricingEngine';
import {
  getMaterialMagnesiumPercentage,
  getMaterialSecondaryNutrientPercentage,
  isMagnesiumGuarantee,
  isSecondaryNutrientGuarantee,
  normalizeMicronutrientKey,
} from '../../utils/micronutrients';

type Constraint = Record<string, number>;
type Variable = Record<string, number>;

export interface OptimizationModel {
  optimize: string;
  opType: 'min';
  constraints: Record<string, Constraint>;
  variables: Record<string, Variable>;
  ints: Record<string, number>;
}

export interface FormulaOptimizationInput {
  target: FormulaTarget;
  targetS?: number;
  targetCa?: number;
  /**
   * Meta de magnésio com a mesma regra de Ca e S (faixa do alvo até +0,9 ponto).
   * Quando informada, o Mg deixa de ser tratado como micronutriente mínimo.
   */
  targetMg?: number;
  targetMicros?: Record<string, number>;
  macros: RawMaterial[];
  micros: RawMaterial[];
  incompatibilityRules: IncompatibilityRule[];
}

export interface FormulaOptimizationResult {
  feasible: boolean;
  macros: RawMaterial[];
  micros: RawMaterial[];
  values: Record<string, number>;
  composition: ReturnType<typeof calculateMaterialComposition>;
}

const numeric = (value: unknown): number => Number(value) || 0;

/**
 * Quanto cada garantia N, P e K pode ficar acima do alvo (em pontos percentuais).
 * Ex.: 5-25-15 aceita até 5,98-25,98-15,98. O otimizador minimiza o custo, então
 * o excedente vai para onde a mistura fica mais barata.
 */
export const NPK_UPPER_TOLERANCE = 0.98;
/** Faixa de Ca, S e Mg acima do alvo (pontos percentuais). */
export const SECONDARY_UPPER_TOLERANCE = 0.9;

/**
 * A garantia obtida está dentro da faixa aceita? Abaixo do alvo, tolera só o
 * arredondamento (0,05); acima, até a tolerância do nutriente.
 */
export function isWithinGuaranteeRange(
  target: number,
  obtained: number,
  upperTolerance: number = NPK_UPPER_TOLERANCE
): boolean {
  return obtained >= target - 0.05 && obtained <= target + upperTolerance + 0.005;
}

const npkRange = (target: number) => ({
  min: target * 10,
  max: Math.round((target + NPK_UPPER_TOLERANCE) * 10 * 1000) / 1000,
});
const secondaryRange = (target: number) => ({
  min: target * 10,
  max: Math.round((target + SECONDARY_UPPER_TOLERANCE) * 10 * 1000) / 1000,
});

export function buildFormulaOptimizationModel({
  target,
  targetS = 0,
  targetCa = 0,
  targetMg = 0,
  targetMicros = {},
  macros,
  micros,
  incompatibilityRules,
}: FormulaOptimizationInput): OptimizationModel {
  const usesMagnesiumRange = numeric(targetMg) > 0;
  const normalizedMicroTargets = new Map<string, { name: string; value: number }>();
  Object.entries(targetMicros)
    .map(([name, value]) => ({ name: name.trim(), value: numeric(value) }))
    .filter(
      ({ name, value }) =>
        name.length > 0 &&
        value > 0 &&
        !isSecondaryNutrientGuarantee(name) &&
        !(usesMagnesiumRange && isMagnesiumGuarantee(name))
    )
    .forEach(({ name, value }) => {
      const key = normalizeMicronutrientKey(name);
      const current = normalizedMicroTargets.get(key);
      normalizedMicroTargets.set(key, {
        name,
        // Dados antigos podem conter a mesma meta como "Zn" e "Zinco".
        // Uma única restrição, com o maior alvo, evita contabilizar o nutriente duas vezes.
        value: Math.max(current?.value || 0, value),
      });
    });
  const microTargets = Array.from(normalizedMicroTargets.entries()).map(([key, target], index) => ({
    ...target,
    key,
    constraint: `micro_target_${index}`,
  }));
  const model: OptimizationModel = {
    optimize: 'cost',
    opType: 'min',
    constraints: {
      n_eq: npkRange(target.n),
      p_eq: npkRange(target.p),
      k_eq: npkRange(target.k),
      ...(targetS > 0 ? { s_eq: secondaryRange(targetS) } : {}),
      ...(targetCa > 0 ? { ca_eq: secondaryRange(targetCa) } : {}),
      ...(usesMagnesiumRange ? { mg_eq: secondaryRange(targetMg) } : {}),
      ...Object.fromEntries(
        // Micronutrient guarantees are minimum declared guarantees. Requiring an exact
        // equality makes a valid blend infeasible whenever one selected source carries
        // more than one micro (for example, the B source also contributes Zn).
        microTargets.map(({ constraint, value }) => [constraint, { min: value * 10 }])
      ),
      weight: { equal: 1000 },
    },
    variables: {},
    ints: {},
  };

  const availableMaterials = [...macros, ...micros].filter((material) => material.selected);
  availableMaterials.forEach((material) => {
    const useVariable = `use_${material.id}`;
    const useLimit = `use_limit_${material.id}`;
    const minimumLink = `link_min_${material.id}`;
    const maximumLink = `link_max_${material.id}`;
    const minimumQuantity = numeric(material.minQty);
    const sulfurPercentage = getMaterialSecondaryNutrientPercentage(material, 's');
    const calciumPercentage = getMaterialSecondaryNutrientPercentage(material, 'ca');
    const magnesiumPercentage = getMaterialMagnesiumPercentage(material);
    const microContributions = Object.fromEntries(
      microTargets.flatMap(({ key, constraint }) => {
        const guarantee = (material.microGuarantees || [])
          .filter((item) => normalizeMicronutrientKey(item.name) === key)
          .reduce((total, item) => total + numeric(item.value), 0);
        return guarantee > 0 ? [[constraint, guarantee / 100]] : [];
      })
    );
    model.variables[material.id] = {
      cost: numeric(material.price),
      ...(numeric(material.n) !== 0 ? { n_eq: numeric(material.n) / 100 } : {}),
      ...(numeric(material.p) !== 0 ? { p_eq: numeric(material.p) / 100 } : {}),
      ...(numeric(material.k) !== 0 ? { k_eq: numeric(material.k) / 100 } : {}),
      ...(targetS > 0 && sulfurPercentage !== 0 ? { s_eq: sulfurPercentage / 100 } : {}),
      ...(targetCa > 0 && calciumPercentage !== 0 ? { ca_eq: calciumPercentage / 100 } : {}),
      ...(usesMagnesiumRange && magnesiumPercentage !== 0
        ? { mg_eq: magnesiumPercentage / 100 }
        : {}),
      ...microContributions,
      weight: 1,
      ...(minimumQuantity > 0 ? { [minimumLink]: 1 } : {}),
      [maximumLink]: 1,
    };
    model.variables[useVariable] = {
      cost: 0.01,
      [useLimit]: 1,
      ...(minimumQuantity > 0 ? { [minimumLink]: -minimumQuantity } : {}),
      [maximumLink]: -(numeric(material.maxQty) || 1000),
    };
    model.ints[useVariable] = 1;
    // javascript-lp-solver distinguishes integer from binary variables. Without
    // this upper bound, use_<id> could become 2, 3, ... and multiply maxQty,
    // allowing the optimizer to exceed the product maximum.
    model.constraints[useLimit] = { max: 1 };
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
    Object.entries(rawResult).filter(
      (entry): entry is [string, number] => typeof entry[1] === 'number'
    )
  );
  const apply = (materials: RawMaterial[]) =>
    materials.map((material) => ({
      ...material,
      quantity: material.selected && feasible ? values[material.id] || 0 : 0,
    }));

  const macros = apply(input.macros);
  const micros = apply(input.micros);
  return {
    feasible,
    values,
    macros,
    micros,
    composition: calculateMaterialComposition(macros, micros),
  };
}
