import { describe, expect, it } from 'vitest';
import type { RawMaterial, TargetFormula } from '../types';
import {
  buildComparisonMaterials,
  buildReducedComparisonFormula,
  calculateComparisonDose,
  isFixedComparisonMaterial,
} from './formulaComparison';

const material = (overrides: Partial<RawMaterial>): RawMaterial => ({
  id: overrides.id || 'material',
  type: overrides.type || 'macro',
  name: overrides.name || 'Produto',
  price: 100,
  n: 0,
  p: 0,
  k: 0,
  s: 0,
  ca: 0,
  microGuarantees: [],
  minQty: 0,
  maxQty: 1000,
  selected: false,
  quantity: 0,
  ...overrides,
});

describe('formula comparison preparation', () => {
  it('preserva produtos selecionados e fixos ao acrescentar candidatos por categoria', () => {
    const selected = material({ id: 'selected', selected: true, minQty: 10, maxQty: 100 });
    const fixed = material({ id: 'fixed', selected: false, minQty: 25, maxQty: 25 });
    const candidate = material({ id: 'candidate', categories: ['phosphated'] });
    const ignored = material({ id: 'ignored', categories: ['nitrogenous'] });

    const result = buildComparisonMaterials({
      available: [selected, fixed, candidate, ignored],
      source: [selected, fixed],
      categoryIds: ['phosphated'],
      includeCategoryCandidates: true,
    });

    expect(result.filter(({ selected }) => selected).map(({ id }) => id)).toEqual([
      'selected',
      'fixed',
      'candidate',
    ]);
    expect(result.find(({ id }) => id === 'fixed')).toMatchObject({ minQty: 25, maxQty: 25 });
  });

  it('identifica fixo somente quando mínimo e máximo positivos são iguais', () => {
    expect(isFixedComparisonMaterial(material({ minQty: 20, maxQty: 20 }))).toBe(true);
    expect(isFixedComparisonMaterial(material({ minQty: 0, maxQty: 0 }))).toBe(false);
    expect(isFixedComparisonMaterial(material({ minQty: 20, maxQty: 30 }))).toBe(false);
  });

  it('gera a fórmula reduzida usando as garantias reais do cartão', () => {
    const source = {
      summary: { resultingN: 10, resultingP: 20, resultingK: 30 },
    } as TargetFormula;
    expect(buildReducedComparisonFormula(source, { n: 10, p: 25, k: 0 })).toBe('9.00-15.00-30.00');
  });

  it('calcula a nova dose pela garantia de referência disponível', () => {
    expect(calculateComparisonDose(200, { n: 18, p: 30, k: 0 }, { n: 9, p: 15, k: 0 })).toBe(200);
  });
});
