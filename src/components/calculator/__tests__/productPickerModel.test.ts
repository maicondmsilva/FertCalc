import { describe, expect, it } from 'vitest';
import type { RawMaterial } from '../../../types';
import {
  filterCounts,
  guaranteeChips,
  matchesFilter,
  matchesSearch,
  targetCoverage,
} from '../productPickerModel';

const m = (patch: Partial<RawMaterial>) =>
  ({
    id: 'x',
    name: 'X',
    type: 'macro',
    n: 0,
    p: 0,
    k: 0,
    s: 0,
    ca: 0,
    price: 1000,
    microGuarantees: [],
    ...patch,
  }) as RawMaterial;

const kcl = m({
  id: 'kcl',
  name: 'KCL Granulado',
  k: 60,
  microGuarantees: [{ name: 'Zn', value: 1 }],
  selected: true,
});
const ureia = m({ id: 'ureia', name: 'Ureia', n: 45, selected: true });
const sulfato = m({ id: 'sa', name: 'Sulfato de Amônio', n: 20, s: 22, price: 0, selected: false });
const premium = m({ id: 'pr', name: 'Super Premium', p: 18, isPremiumLine: true });
const custom = m({ id: 'c', name: 'Mistura X', p: 10, isCustomMaterial: true, selected: true });

describe('modal de produtos: filtros, busca e cobertura', () => {
  it('etiquetas de garantia', () => {
    expect(guaranteeChips(kcl)).toEqual(['K 60%', 'Zn 1%']);
    expect(guaranteeChips(sulfato)).toEqual(['N 20%', 'S 22%']);
  });

  it('busca pelo nome sem acento ou pela garantia', () => {
    expect(matchesSearch(sulfato, 'amonio')).toBe(true);
    expect(matchesSearch(kcl, 'zn')).toBe(true);
    expect(matchesSearch(kcl, 'zinco')).toBe(true);
    expect(matchesSearch(ureia, 'zn')).toBe(false);
    expect(matchesSearch(sulfato, 's')).toBe(true);
    expect(matchesSearch(ureia, '')).toBe(true);
  });

  it('filtros e contadores', () => {
    const all = [kcl, ureia, sulfato, premium, custom];
    expect(filterCounts(all)).toEqual({ all: 5, selected: 3, unpriced: 1, premium: 1, custom: 1 });
    expect(matchesFilter(sulfato, 'unpriced')).toBe(true);
  });

  it('cobertura das garantias da meta pelos selecionados', () => {
    const coverage = targetCoverage(
      { formula: '10-10-10', targetS: 5, targetCa: 0, targetMicros: { Zn: 0.5, B: 0.2 } },
      [kcl, ureia]
    );
    expect(coverage).toEqual([
      { label: 'N', covered: true },
      { label: 'P', covered: false },
      { label: 'K', covered: true },
      { label: 'S', covered: false },
      { label: 'Zn', covered: true },
      { label: 'B', covered: false },
    ]);
  });
});
