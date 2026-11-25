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

const MICRONUTRIENT_ALIASES: Record<string, string> = {
  B: 'B',
  BORO: 'B',
  ZN: 'ZN',
  ZINCO: 'ZN',
  MN: 'MN',
  MANGANES: 'MN',
  CU: 'CU',
  COBRE: 'CU',
  FE: 'FE',
  FERRO: 'FE',
  MO: 'MO',
  MOLIBDENIO: 'MO',
  CO: 'CO',
  COBALTO: 'CO',
  NI: 'NI',
  NIQUEL: 'NI',
  CL: 'CL',
  CLORO: 'CL',
  SE: 'SE',
  SELENIO: 'SE',
  SI: 'SI',
  SILICIO: 'SI',
  CA: 'CA',
  CALCIO: 'CA',
  S: 'S',
  ENXOFRE: 'S',
};

const toAliasKey = (name: string) =>
  name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleUpperCase('pt-BR');

/** Siglas do cadastro de nutrientes (chave → sigla para exibir, ex.: ZN → Zn). */
const REGISTERED_LABELS = new Map<string, string>();

export interface NutrientDefinition {
  sigla: string;
  nome: string;
  aliases?: string[];
}

/**
 * Liga o cadastro de nutrientes ao cálculo: sigla, nome e nomes alternativos de
 * cada nutriente passam a ser reconhecidos como o mesmo nutriente (além da lista
 * fixa abaixo, que continua valendo para dados antigos).
 */
export function registerNutrients(nutrients: NutrientDefinition[]): void {
  nutrients.forEach((nutrient) => {
    const key = toAliasKey(nutrient.sigla);
    if (!key) return;
    REGISTERED_LABELS.set(key, nutrient.sigla.trim());
    [nutrient.sigla, nutrient.nome, ...(nutrient.aliases || [])].forEach((alias) => {
      const aliasKey = toAliasKey(alias || '');
      if (aliasKey) MICRONUTRIENT_ALIASES[aliasKey] = key;
    });
  });
}

export const normalizeMicronutrientKey = (name: string) => {
  const normalized = toAliasKey(name);
  return MICRONUTRIENT_ALIASES[normalized] || normalized;
};

export const formatMicronutrientLabel = (name: string) => {
  const registered = REGISTERED_LABELS.get(normalizeMicronutrientKey(name));
  if (registered) return registered;
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
    .filter((guarantee) =>
      SECONDARY_NUTRIENT_KEYS[nutrient].has(normalizeMicronutrientKey(guarantee.name))
    )
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

const MAGNESIUM_KEYS = new Set(['MG', 'MAGNESIO']);

/** Identifica garantias de magnésio, aceitando "Mg" e "Magnésio". */
export const isMagnesiumGuarantee = (name: string) =>
  MAGNESIUM_KEYS.has(normalizeMicronutrientKey(name));

/** Percentual de magnésio informado nas garantias do produto. */
export function getMaterialMagnesiumPercentage(material: MicronutrientCarrier): number {
  return (material.microGuarantees || [])
    .filter((guarantee) => isMagnesiumGuarantee(guarantee.name))
    .reduce((total, guarantee) => total + (Number(guarantee.value) || 0), 0);
}

/** Lê a meta de magnésio gravada entre as metas de micronutrientes, se houver. */
export function getMagnesiumTarget(
  targets: Record<string, number> | undefined
): number | undefined {
  const entry = Object.entries(targets || {}).find(([name]) => isMagnesiumGuarantee(name));
  return entry ? Number(entry[1]) || undefined : undefined;
}

/** Remove a meta de magnésio das metas de micronutrientes quando ele usa a regra de faixa. */
export function withoutMagnesiumTarget(
  targets: Record<string, number> | undefined
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(targets || {}).filter(([name]) => !isMagnesiumGuarantee(name))
  );
}
