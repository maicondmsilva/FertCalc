import type { IncompatibilityRule, RawMaterial } from '../../types';
import {
  formatMicronutrientLabel,
  getMaterialSecondaryNutrientPercentage,
  isSecondaryNutrientGuarantee,
  normalizeMicronutrientKey,
} from '../../utils/micronutrients';
import type { FormulaOptimizationInput } from './optimizationEngine';

export type OptimizationDiagnosticCode =
  | 'NO_SELECTED_MATERIALS'
  | 'INVALID_PRODUCT_LIMIT'
  | 'FIXED_WEIGHT_EXCEEDS_BATCH'
  | 'WEIGHT_CAPACITY_BELOW_BATCH'
  | 'FIXED_INCOMPATIBILITY'
  | 'NUTRIENT_SOURCE_MISSING'
  | 'NUTRIENT_CAPACITY_INSUFFICIENT'
  | 'FIXED_NUTRIENT_EXCEEDS_TARGET'
  | 'COMBINED_CONSTRAINTS';

export interface OptimizationDiagnostic {
  code: OptimizationDiagnosticCode;
  message: string;
  materialNames?: string[];
  nutrient?: string;
  required?: number;
  available?: number;
}

const numeric = (value: unknown): number => Number(value) || 0;
const maxQuantity = (material: RawMaterial): number => numeric(material.maxQty) || 1000;
const isFixed = (material: RawMaterial): boolean =>
  numeric(material.minQty) > 0 && numeric(material.minQty) === numeric(material.maxQty);

interface NutrientRequirement {
  key: string;
  label: string;
  target: number;
  percentage: (material: RawMaterial) => number;
  hasUpperTarget: boolean;
  upperTargetAppliesAtZero?: boolean;
}

const buildNutrientRequirements = ({
  target,
  targetCa = 0,
  targetS = 0,
  targetMicros = {},
}: FormulaOptimizationInput): NutrientRequirement[] => {
  const requirements: NutrientRequirement[] = [
    {
      key: 'N',
      label: 'N',
      target: target.n,
      percentage: (item) => numeric(item.n),
      hasUpperTarget: true,
      upperTargetAppliesAtZero: true,
    },
    {
      key: 'P',
      label: 'P',
      target: target.p,
      percentage: (item) => numeric(item.p),
      hasUpperTarget: true,
      upperTargetAppliesAtZero: true,
    },
    {
      key: 'K',
      label: 'K',
      target: target.k,
      percentage: (item) => numeric(item.k),
      hasUpperTarget: true,
      upperTargetAppliesAtZero: true,
    },
    {
      key: 'CA',
      label: 'Ca',
      target: targetCa,
      percentage: (item) => getMaterialSecondaryNutrientPercentage(item, 'ca'),
      hasUpperTarget: true,
    },
    {
      key: 'S',
      label: 'S',
      target: targetS,
      percentage: (item) => getMaterialSecondaryNutrientPercentage(item, 's'),
      hasUpperTarget: true,
    },
  ];

  const microTargets = new Map<string, { label: string; target: number }>();
  Object.entries(targetMicros)
    .filter(
      ([name, value]) =>
        name.trim().length > 0 && numeric(value) > 0 && !isSecondaryNutrientGuarantee(name)
    )
    .forEach(([name, value]) => {
      const key = normalizeMicronutrientKey(name);
      const current = microTargets.get(key);
      microTargets.set(key, {
        label: formatMicronutrientLabel(name),
        target: Math.max(current?.target || 0, numeric(value)),
      });
    });

  microTargets.forEach(({ label, target: microTarget }, key) => {
    requirements.push({
      key,
      label,
      target: microTarget,
      percentage: (material) =>
        (material.microGuarantees || [])
          .filter((guarantee) => normalizeMicronutrientKey(guarantee.name) === key)
          .reduce((total, guarantee) => total + numeric(guarantee.value), 0),
      hasUpperTarget: false,
    });
  });

  return requirements;
};

const diagnoseIncompatibilities = (
  fixedMaterials: RawMaterial[],
  incompatibilityRules: IncompatibilityRule[]
): OptimizationDiagnostic[] => {
  const fixedById = new Map(fixedMaterials.map((material) => [material.id, material]));
  return incompatibilityRules.flatMap((rule) => {
    const first = fixedById.get(rule.materialAId);
    const second = fixedById.get(rule.materialBId);
    if (!first || !second) return [];
    return [
      {
        code: 'FIXED_INCOMPATIBILITY' as const,
        message: `${first.name} e ${second.name} estão fixos, mas são incompatíveis entre si.`,
        materialNames: [first.name, second.name],
      },
    ];
  });
};

export function diagnoseFormulaInfeasibility(
  input: FormulaOptimizationInput
): OptimizationDiagnostic[] {
  const selected = [...input.macros, ...input.micros].filter((material) => material.selected);
  if (selected.length === 0) {
    return [
      {
        code: 'NO_SELECTED_MATERIALS',
        message: 'Nenhum produto foi selecionado para compor a fórmula.',
      },
    ];
  }

  const diagnostics: OptimizationDiagnostic[] = [];
  selected.forEach((material) => {
    const minimum = numeric(material.minQty);
    const maximum = numeric(material.maxQty);
    if (minimum < 0 || maximum < 0 || (maximum > 0 && minimum > maximum)) {
      diagnostics.push({
        code: 'INVALID_PRODUCT_LIMIT',
        message: `${material.name} possui limite mínimo maior que o máximo.`,
        materialNames: [material.name],
      });
    }
  });

  const fixedMaterials = selected.filter(isFixed);
  const fixedWeight = fixedMaterials.reduce(
    (total, material) => total + numeric(material.minQty),
    0
  );
  if (fixedWeight > 1000) {
    diagnostics.push({
      code: 'FIXED_WEIGHT_EXCEEDS_BATCH',
      message: `Os produtos fixos somam ${fixedWeight.toFixed(2)} kg e ultrapassam a batida de 1.000 kg.`,
      materialNames: fixedMaterials.map((material) => material.name),
      required: 1000,
      available: fixedWeight,
    });
  }

  const totalCapacity = selected.reduce((total, material) => total + maxQuantity(material), 0);
  if (totalCapacity < 1000) {
    diagnostics.push({
      code: 'WEIGHT_CAPACITY_BELOW_BATCH',
      message: `Os máximos selecionados permitem somente ${totalCapacity.toFixed(2)} kg; a batida exige 1.000 kg.`,
      materialNames: selected.map((material) => material.name),
      required: 1000,
      available: totalCapacity,
    });
  }

  diagnostics.push(...diagnoseIncompatibilities(fixedMaterials, input.incompatibilityRules));

  buildNutrientRequirements(input).forEach((requirement) => {
    if (requirement.target > 0) {
      const sources = selected.filter((material) => requirement.percentage(material) > 0);
      if (sources.length === 0) {
        diagnostics.push({
          code: 'NUTRIENT_SOURCE_MISSING',
          message: `Nenhum produto selecionado fornece ${requirement.label}.`,
          nutrient: requirement.label,
          required: requirement.target,
          available: 0,
        });
      } else {
        const requiredMass = requirement.target * 10;
        const maximumMass = sources.reduce(
          (total, material) =>
            total + maxQuantity(material) * (requirement.percentage(material) / 100),
          0
        );
        if (maximumMass + 1e-7 < requiredMass) {
          diagnostics.push({
            code: 'NUTRIENT_CAPACITY_INSUFFICIENT',
            message: `Os limites máximos fornecem até ${(maximumMass / 10).toFixed(2)}% de ${requirement.label}, abaixo do alvo de ${requirement.target.toFixed(2)}%.`,
            materialNames: sources.map((material) => material.name),
            nutrient: requirement.label,
            required: requirement.target,
            available: maximumMass / 10,
          });
        }
      }
    }

    if (
      requirement.hasUpperTarget &&
      (requirement.target > 0 || requirement.upperTargetAppliesAtZero)
    ) {
      const fixedMass = fixedMaterials.reduce(
        (total, material) =>
          total + numeric(material.minQty) * (requirement.percentage(material) / 100),
        0
      );
      const upperMass = requirement.target * 10 + 9;
      if (fixedMass > upperMass + 1e-7) {
        diagnostics.push({
          code: 'FIXED_NUTRIENT_EXCEEDS_TARGET',
          message: `Os produtos fixos já entregam ${(fixedMass / 10).toFixed(2)}% de ${requirement.label}, acima do permitido para o alvo de ${requirement.target.toFixed(2)}%.`,
          materialNames: fixedMaterials
            .filter((material) => requirement.percentage(material) > 0)
            .map((material) => material.name),
          nutrient: requirement.label,
          required: requirement.target,
          available: fixedMass / 10,
        });
      }
    }
  });

  if (diagnostics.length === 0) {
    diagnostics.push({
      code: 'COMBINED_CONSTRAINTS',
      message:
        'A combinação de mínimos, máximos, quantidades fixas, incompatibilidades e garantias não permite fechar 1.000 kg.',
    });
  }
  return diagnostics;
}

export const formatOptimizationDiagnostics = (
  diagnostics: OptimizationDiagnostic[],
  limit = 3
): string =>
  diagnostics
    .slice(0, limit)
    .map(({ message }) => message)
    .join(' ');
