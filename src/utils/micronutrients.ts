interface MicronutrientGuarantee {
  name: string;
  value: number;
}

interface MicronutrientCarrier {
  ativo?: boolean;
  selected?: boolean;
  microGuarantees?: MicronutrientGuarantee[];
}

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

export function getCatalogMicronutrientNames(materials: MicronutrientCarrier[]): string[] {
  const names = new Map<string, string>();
  materials
    .filter((material) => material.ativo !== false)
    .flatMap((material) => material.microGuarantees || [])
    .filter((guarantee) => guarantee.name.trim() && Number(guarantee.value) > 0)
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
