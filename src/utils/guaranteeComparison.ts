import type { PricingSummary } from '../types';
import {
  formatMicronutrientLabel,
  getCalculatedMicronutrientValue,
  getMicronutrientTargetStatus,
  isSecondaryNutrientGuarantee,
  normalizeMicronutrientKey,
  type MicronutrientTargetStatus,
} from './micronutrients';

export interface GuaranteeComparison {
  key: string;
  label: string;
  calculated: number;
  target?: number;
  status: MicronutrientTargetStatus;
  kind: 'secondary' | 'micro';
}

export function buildGuaranteeComparisons(
  summary: Pick<PricingSummary, 'resultingCa' | 'resultingS' | 'resultingMicros'>,
  targets: {
    targetCa?: number;
    targetS?: number;
    targetMicros?: Record<string, number>;
  }
): GuaranteeComparison[] {
  const comparisons: GuaranteeComparison[] = [];
  const addSecondary = (key: 'CA' | 'S', label: string, calculated: number, target?: number) => {
    if (Number(calculated || 0) <= 0 && Number(target || 0) <= 0) return;
    comparisons.push({
      key,
      label,
      calculated: Number(calculated || 0),
      target: Number(target || 0) > 0 ? Number(target) : undefined,
      status: getMicronutrientTargetStatus(target, calculated),
      kind: 'secondary',
    });
  };

  addSecondary('CA', 'Cálcio (Ca)', summary.resultingCa, targets.targetCa);
  addSecondary('S', 'Enxofre (S)', summary.resultingS, targets.targetS);

  const names = new Map<string, string>();
  Object.keys(summary.resultingMicros || {}).forEach((name) => {
    if (!isSecondaryNutrientGuarantee(name)) {
      names.set(normalizeMicronutrientKey(name), formatMicronutrientLabel(name));
    }
  });
  Object.entries(targets.targetMicros || {})
    .filter(([name, value]) => Number(value) > 0 && !isSecondaryNutrientGuarantee(name))
    .forEach(([name]) => {
      const key = normalizeMicronutrientKey(name);
      if (!names.has(key)) names.set(key, formatMicronutrientLabel(name));
    });

  Array.from(names.entries())
    .sort(([, left], [, right]) => left.localeCompare(right, 'pt-BR'))
    .forEach(([key, label]) => {
      const targetEntry = Object.entries(targets.targetMicros || {}).find(
        ([name]) => normalizeMicronutrientKey(name) === key
      );
      const calculated = Number(getCalculatedMicronutrientValue(summary.resultingMicros, label) || 0);
      const target = Number(targetEntry?.[1] || 0) > 0 ? Number(targetEntry?.[1]) : undefined;
      comparisons.push({
        key,
        label,
        calculated,
        target,
        status: getMicronutrientTargetStatus(target, calculated),
        kind: 'micro',
      });
    });

  return comparisons;
}
