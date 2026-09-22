interface MicronutrientGuarantee {
  name: string;
  value: number;
}

interface MicronutrientCarrier {
  ativo?: boolean;
  selected?: boolean;
  microGuarantees?: MicronutrientGuarantee[];
}

type SecondaryNutrient = 'ca' | 's';

const SECONDARY_NUTRIENT_KEYS: Record<SecondaryNutrient, Set<string>> = {
  ca: new Set(['CA', 'CALCIO']),
  s: new Set(['S', 'ENXOFRE']),
};

export const normalizeMicronutrientKey = (name: string) =>
  name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleUpperCase('pt-BR');

export const formatMicronutrientLabel = (name: string) => {
  const trimmedName = name.trim();
  return /^[a-z]{1,3}$/i.test(trimmedName)
    ? `${trimmedName.charAt(0).toLocaleUpperCase('pt-BR')}${trimmedName.slice(1).toLocaleLowerCase('pt-BR')}`
    : trimmedName;
};

export const isSecondaryNutrientGuarantee = (name: string) => {
  const key = normalizeMicronutrientKey(name);
  return SECONDARY_NUTRIENT_KEYS.ca.has(key) || SECONDARY_NUTRIENT_KEYS.s.has(key);
};

export function getMaterialSecondaryNutrientPercentage(
  material: MicronutrientCarrier & Partial<Record<SecondaryNutrient, number>>,
  nutrient: SecondaryNutrient
): number {
  const registeredPercentage = Number(material[nutrient]) || 0;
  const guaranteePercentage = (material.microGuarantees || [])
    .filter((guarantee) => SECONDARY_NUTRIENT_KEYS[nutrient].has(normalizeMicronutrientKey(guarantee.name)))
    .reduce((total, guarantee) => total + (Number(guarantee.value) || 0), 0);
  return registeredPercentage + guaranteePercentage;
}

export function getSecondaryNutrientTarget(
  targets: Record<string, number> | undefined,
  nutrient: SecondaryNutrient
): number | undefined {
  const entry = Object.entries(targets || {}).find(([name]) =>
    SECONDARY_NUTRIENT_KEYS[nutrient].has(normalizeMicronutrientKey(name))
  );
  return entry ? Number(entry[1]) || undefined : undefined;
}

export function getCatalogMicronutrientNames(materials: MicronutrientCarrier[]): string[] {
  const names = new Map<string, string>();
  materials
    .filter((material) => material.ativo !== false)
    .flatMap((material) => material.microGuarantees || [])
    .filter(
      (guarantee) =>
        guarantee.name.trim() &&
        Number(guarantee.value) > 0 &&
        !isSecondaryNutrientGuarantee(guarantee.name)
    )
    .forEach((guarantee) => {
      const key = normalizeMicronutrientKey(guarantee.name);
      if (!names.has(key)) names.set(key, formatMicronutrientLabel(guarantee.name));
    });
  return Array.from(names.values()).sort((left, right) => left.localeCompare(right, 'pt-BR'));
}

export function getMissingSelectedMicronutrientSources(
  targets: Record<string, number> | undefined,
  materials: MicronutrientCarrier[]
): string[] {
  const selectedGuarantees = new Set(
    materials
      .filter((material) => material.selected)
      .flatMap((material) => material.microGuarantees || [])
      .filter((guarantee) => guarantee.name.trim() && Number(guarantee.value) > 0)
      .map((guarantee) => normalizeMicronutrientKey(guarantee.name))
  );
  const missing = new Map<string, string>();
  Object.entries(targets || {})
    .filter(([name, value]) => name.trim() && Number(value) > 0)
    .forEach(([name]) => {
      const key = normalizeMicronutrientKey(name);
      if (!selectedGuarantees.has(key) && !missing.has(key)) {
        missing.set(key, formatMicronutrientLabel(name));
      }
    });
  return Array.from(missing.values()).sort((left, right) => left.localeCompare(right, 'pt-BR'));
}

export function getCalculatedMicronutrientValue(
  calculated: Record<string, number> | undefined,
  name: string
): number | undefined {
  const key = normalizeMicronutrientKey(name);
  return Object.entries(calculated || {}).find(
    ([calculatedName]) => normalizeMicronutrientKey(calculatedName) === key
  )?.[1];
}

export type MicronutrientTargetStatus = 'inactive' | 'pending' | 'met' | 'divergent';

export function getMicronutrientTargetStatus(
  target: number | undefined,
  calculated: number | undefined,
  tolerance = 0.01
): MicronutrientTargetStatus {
  if (!Number.isFinite(target) || Number(target) <= 0) return 'inactive';
  if (!Number.isFinite(calculated)) return 'pending';
  return Math.abs(Number(calculated) - Number(target)) <= tolerance ? 'met' : 'divergent';
}
