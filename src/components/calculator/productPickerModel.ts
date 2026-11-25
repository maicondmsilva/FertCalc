import type { RawMaterial, TargetFormula } from '../../types';
import { parseFormulaTarget } from '../../domain/pricing-engine/formulaEngine';
import {
  getMaterialSecondaryNutrientPercentage,
  normalizeMicronutrientKey,
  formatMicronutrientLabel,
} from '../../utils/micronutrients';
import { isUnpricedMaterial } from '../../utils/unpricedMaterials';

export type ProductFilter = 'all' | 'selected' | 'unpriced' | 'premium' | 'custom';

export const isPicked = (material: RawMaterial) => material.selected === true;

const normalize = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Garantias do produto em etiquetas curtas: "N 45%", "B 0,5%". */
export function guaranteeChips(material: RawMaterial): string[] {
  const percent = (value: number) => `${String(Number(value)).replace('.', ',')}%`;
  const chips: string[] = [];
  if (material.type === 'macro') {
    (['n', 'p', 'k', 's', 'ca'] as const).forEach((key) => {
      const value = Number(material[key]) || 0;
      if (value > 0) chips.push(`${key === 'ca' ? 'Ca' : key.toUpperCase()} ${percent(value)}`);
    });
  }
  (material.microGuarantees || []).forEach((guarantee) => {
    if (guarantee.name && Number(guarantee.value) > 0) {
      chips.push(`${formatMicronutrientLabel(guarantee.name)} ${percent(guarantee.value)}`);
    }
  });
  return chips;
}

export function matchesFilter(material: RawMaterial, filter: ProductFilter): boolean {
  switch (filter) {
    case 'selected':
      return isPicked(material);
    case 'unpriced':
      return isUnpricedMaterial(material);
    case 'premium':
      return !!material.isPremiumLine;
    case 'custom':
      return !!material.isCustomMaterial;
    default:
      return true;
  }
}

/** Busca pelo nome ou pela garantia (ex.: "zn" acha tudo que tem zinco). */
export function matchesSearch(material: RawMaterial, search: string): boolean {
  const term = normalize(search);
  if (!term) return true;
  if (normalize(material.name).includes(term)) return true;
  const key = normalizeMicronutrientKey(search);
  return (
    (material.microGuarantees || []).some(
      (guarantee) => normalizeMicronutrientKey(guarantee.name) === key && guarantee.value > 0
    ) || guaranteeChips(material).some((chip) => normalize(chip).startsWith(`${term} `))
  );
}

export function filterCounts(materials: RawMaterial[]): Record<ProductFilter, number> {
  return {
    all: materials.length,
    selected: materials.filter((item) => matchesFilter(item, 'selected')).length,
    unpriced: materials.filter((item) => matchesFilter(item, 'unpriced')).length,
    premium: materials.filter((item) => matchesFilter(item, 'premium')).length,
    custom: materials.filter((item) => matchesFilter(item, 'custom')).length,
  };
}

export interface NutrientCoverage {
  label: string;
  covered: boolean;
}

/**
 * Para cada garantia da meta (NPK da fórmula, S, Ca e micros), se algum produto
 * selecionado a fornece. Ajuda a ver, antes de calcular, o que vai faltar.
 */
export function targetCoverage(
  formula: Pick<TargetFormula, 'formula' | 'targetS' | 'targetCa' | 'targetMicros'>,
  selected: RawMaterial[]
): NutrientCoverage[] {
  const target = parseFormulaTarget(formula.formula);
  const items: NutrientCoverage[] = [];
  const has = (predicate: (material: RawMaterial) => boolean) => selected.some(predicate);
  if (target) {
    (['n', 'p', 'k'] as const).forEach((key) => {
      if (target[key] > 0) {
        items.push({ label: key.toUpperCase(), covered: has((m) => Number(m[key]) > 0) });
      }
    });
  }
  if (Number(formula.targetS) > 0) {
    items.push({
      label: 'S',
      covered: has((m) => getMaterialSecondaryNutrientPercentage(m, 's') > 0),
    });
  }
  if (Number(formula.targetCa) > 0) {
    items.push({
      label: 'Ca',
      covered: has((m) => getMaterialSecondaryNutrientPercentage(m, 'ca') > 0),
    });
  }
  Object.entries(formula.targetMicros || {}).forEach(([name, value]) => {
    if (!(Number(value) > 0)) return;
    const key = normalizeMicronutrientKey(name);
    if (items.some((item) => normalizeMicronutrientKey(item.label) === key)) return;
    items.push({
      label: formatMicronutrientLabel(name),
      covered: has((m) =>
        (m.microGuarantees || []).some(
          (guarantee) => normalizeMicronutrientKey(guarantee.name) === key && guarantee.value > 0
        )
      ),
    });
  });
  return items;
}
