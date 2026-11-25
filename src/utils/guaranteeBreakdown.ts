import type { RawMaterial } from '../types';
import {
  formatMicronutrientLabel,
  getMaterialMagnesiumPercentage,
  getMaterialSecondaryNutrientPercentage,
  isMagnesiumGuarantee,
  isSecondaryNutrientGuarantee,
  normalizeMicronutrientKey,
} from './micronutrients';

export interface GuaranteeContribution {
  materialId: string;
  name: string;
  /** Pontos percentuais que este produto leva à batida. */
  percent: number;
}

export interface GuaranteeRow {
  key: string;
  label: string;
  kind: 'primario' | 'secundario' | 'micro';
  /** Meta da fórmula (0 = sem meta). */
  target: number;
  /** Garantia obtida na batida (%), soma das contribuições. */
  obtained: number;
  contributions: GuaranteeContribution[];
}

export interface GuaranteeTargets {
  n?: number;
  p?: number;
  k?: number;
  s?: number;
  ca?: number;
  mg?: number;
  micros?: Record<string, number>;
}

const numeric = (value: unknown) => Number(value) || 0;

/**
 * Soma de cada garantia que entrou na batida — N, P, K, S, Ca, Mg e cada micro,
 * inclusive os que vêm dentro dos macros — com a contribuição de cada produto.
 * Mesma conta do cálculo: (kg do produto × % da garantia) ÷ peso total.
 */
export function buildGuaranteeBreakdown(
  materials: RawMaterial[],
  targets: GuaranteeTargets = {}
): GuaranteeRow[] {
  const used = materials.filter(
    (material) => material.selected !== false && numeric(material.quantity) > 0
  );
  const totalWeight = used.reduce((total, material) => total + numeric(material.quantity), 0);
  const rows = new Map<string, GuaranteeRow>();

  const ensure = (key: string, label: string, kind: GuaranteeRow['kind'], target = 0) => {
    if (!rows.has(key)) rows.set(key, { key, label, kind, target, obtained: 0, contributions: [] });
    return rows.get(key)!;
  };
  const add = (row: GuaranteeRow, material: RawMaterial, percentOfMaterial: number) => {
    if (!(percentOfMaterial > 0) || totalWeight <= 0) return;
    const percent = (numeric(material.quantity) * percentOfMaterial) / totalWeight;
    row.obtained += percent;
    const existing = row.contributions.find((item) => item.materialId === material.id);
    if (existing) existing.percent += percent;
    else row.contributions.push({ materialId: material.id, name: material.name, percent });
  };

  const fixed: [string, string, GuaranteeRow['kind'], number][] = [
    ['N', 'N', 'primario', numeric(targets.n)],
    ['P', 'P', 'primario', numeric(targets.p)],
    ['K', 'K', 'primario', numeric(targets.k)],
    ['S', 'S', 'secundario', numeric(targets.s)],
    ['CA', 'Ca', 'secundario', numeric(targets.ca)],
    ['MG', 'Mg', 'secundario', numeric(targets.mg)],
  ];
  fixed.forEach(([key, label, kind, target]) => ensure(key, label, kind, target));

  Object.entries(targets.micros || {}).forEach(([name, value]) => {
    if (!(numeric(value) > 0)) return;
    if (isSecondaryNutrientGuarantee(name) || isMagnesiumGuarantee(name)) return;
    const key = normalizeMicronutrientKey(name);
    const row = ensure(key, formatMicronutrientLabel(key), 'micro');
    row.target = Math.max(row.target, numeric(value));
  });

  used.forEach((material) => {
    add(rows.get('N')!, material, numeric(material.n));
    add(rows.get('P')!, material, numeric(material.p));
    add(rows.get('K')!, material, numeric(material.k));
    add(rows.get('S')!, material, getMaterialSecondaryNutrientPercentage(material, 's'));
    add(rows.get('CA')!, material, getMaterialSecondaryNutrientPercentage(material, 'ca'));
    add(rows.get('MG')!, material, getMaterialMagnesiumPercentage(material));
    (material.microGuarantees || []).forEach((guarantee) => {
      if (!guarantee.name) return;
      if (isSecondaryNutrientGuarantee(guarantee.name) || isMagnesiumGuarantee(guarantee.name))
        return;
      const key = normalizeMicronutrientKey(guarantee.name);
      add(ensure(key, formatMicronutrientLabel(key), 'micro'), material, numeric(guarantee.value));
    });
  });

  const order = { primario: 0, secundario: 1, micro: 2 } as const;
  return [...rows.values()]
    .filter((row) => row.obtained > 0 || row.target > 0)
    .map((row) => ({
      ...row,
      contributions: row.contributions.sort((a, b) => b.percent - a.percent),
    }))
    .sort((a, b) =>
      a.kind === b.kind
        ? a.kind === 'micro'
          ? a.label.localeCompare(b.label)
          : 0
        : order[a.kind] - order[b.kind]
    );
}
