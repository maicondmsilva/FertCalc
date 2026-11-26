import { describe, expect, it } from 'vitest';
import type { RawMaterial, TargetFormula } from '../types';
import { applyCategoryFilter, belongsToCategory } from './categoryFilter';
import { buildFormulaComparisonAlternatives } from './formulaComparison';
import { calculateTargetFormula } from '../domain/pricing-engine';

const material = (overrides: Partial<RawMaterial>): RawMaterial => ({
  id: overrides.id || 'material',
  type: overrides.type || 'macro',
  name: overrides.name || overrides.id || 'Produto',
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

// Cadastro parecido com o caso real (14-00-19 com uréia ou nitrato).
const ureia = material({ id: 'ureia', n: 45, price: 3200, categories: ['c-ureia'] });
const nitrato = material({ id: 'nitrato', n: 27, ca: 18, price: 2900, categories: ['c-nitrato'] });
const sulfato = material({
  id: 'sam',
  n: 20,
  s: 22,
  price: 2100,
  categories: ['c-ureia', 'c-nitrato'],
});
const kcl = material({ id: 'kcl', k: 60, price: 2950, categories: ['c-ureia', 'c-nitrato'] });
const enchimento = material({ id: 'enchimento', price: 150, categories: ['c-ureia', 'c-nitrato'] });
const boro = material({
  id: 'boro',
  type: 'micro',
  price: 5000,
  microGuarantees: [{ name: 'B', value: 10 }],
});
const catalog = [ureia, nitrato, sulfato, kcl, enchimento];

describe('filtro por categoria', () => {
  it('"Todas" marca macros sem linha premium e nenhum micro', () => {
    expect(belongsToCategory(material({ isPremiumLine: true }), 'all', 'macro')).toBe(false);
    expect(belongsToCategory(material({}), 'all', 'macro')).toBe(true);
    expect(belongsToCategory(boro, 'all', 'micro')).toBe(false);
  });

  it('mantém fixados (📌), quantidade fixa e personalizadas; preserva mín/máx e preço', () => {
    const current = [
      { ...ureia, selected: true, maxQty: 300, price: 3100 },
      { ...kcl, selected: true },
      material({ id: 'fixado', selected: true, pinned: true }),
      material({ id: 'fixo', selected: true, minQty: 50, maxQty: 50 }),
      material({ id: 'custom', selected: true, isCustomMaterial: true }),
    ];
    const result = applyCategoryFilter({
      current,
      catalog: [...catalog, material({ id: 'fixado' }), material({ id: 'fixo' })],
      category: 'c-nitrato',
      type: 'macro',
    });
    const byId = new Map(result.map((item) => [item.id, item]));
    expect(byId.get('ureia')).toMatchObject({ selected: false, maxQty: 300, price: 3100 });
    expect(byId.get('nitrato')?.selected).toBe(true);
    expect(byId.get('kcl')?.selected).toBe(true);
    expect(byId.get('fixado')?.selected).toBe(true);
    expect(byId.get('fixo')?.selected).toBe(true);
    expect(byId.get('custom')?.selected).toBe(true);
  });

  it('micro marcado à mão (📌) continua marcado ao trocar o filtro', () => {
    const result = applyCategoryFilter({
      current: [{ ...boro, selected: true, pinned: true }],
      catalog: [boro],
      category: 'c-nitrato',
      type: 'micro',
    });
    expect(result[0].selected).toBe(true);
  });

  it('comparar com c/nitrato dá o MESMO custo de trocar o filtro para c/nitrato e calcular', () => {
    const base = {
      id: 'f1',
      formula: '14-00-19',
      selected: true,
      category: 'c-ureia',
      factors: {
        factor: 1,
        discount: 0,
        margin: 0,
        freight: 0,
        taxRate: 0,
        commission: 0,
        totalTons: 1,
      },
      macros: applyCategoryFilter({
        current: catalog,
        catalog,
        category: 'c-ureia',
        type: 'macro',
      }),
      micros: [],
    } as unknown as TargetFormula;
    const calc = (formula: TargetFormula) =>
      calculateTargetFormula({
        calculation: formula,
        defaultMacros: formula.macros,
        defaultMicros: formula.micros,
        microsInGear: true,
        incompatibilityRules: [],
      }).calculation;

    const withUreia = calc(base);
    expect(withUreia.summary).toBeTruthy();

    // Caminho 1: troca o filtro para c/nitrato e calcula.
    const direct = calc({
      ...base,
      category: 'c-nitrato' as never,
      macros: applyCategoryFilter({
        current: base.macros,
        catalog,
        category: 'c-nitrato',
        type: 'macro',
      }),
    });
    // Caminho 2: na fórmula com uréia já calculada, compara com c/nitrato.
    const [comparison] = buildFormulaComparisonAlternatives({
      sourceCalculation: withUreia,
      availableMacros: catalog,
      availableMicros: [],
      categories: [{ id: 'c-nitrato', nome: 'C/ Nitrato', ordem: 1, ativo: true }] as never,
      selectedCategoryIds: ['c-nitrato'],
      reductions: { n: 0, p: 0, k: 0 },
      incompatibilityRules: [],
    });

    expect(comparison.feasible).toBe(true);
    expect(comparison.calculation.summary?.baseCost).toBeCloseTo(direct.summary!.baseCost, 6);

    // E comparar com a própria categoria (uréia) repete o custo da fórmula.
    const [same] = buildFormulaComparisonAlternatives({
      sourceCalculation: withUreia,
      availableMacros: catalog,
      availableMicros: [],
      categories: [{ id: 'c-ureia', nome: 'C/ Uréia', ordem: 1, ativo: true }] as never,
      selectedCategoryIds: ['c-ureia'],
      reductions: { n: 0, p: 0, k: 0 },
      incompatibilityRules: [],
    });
    expect(same.calculation.summary?.baseCost).toBeCloseTo(withUreia.summary!.baseCost, 6);
  });
});
