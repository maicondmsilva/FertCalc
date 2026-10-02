import { describe, expect, it } from 'vitest';
import type { RawMaterial, TargetFormula } from '../types';
import {
  buildAppliedComparisonCalculation,
  buildComparisonMaterials,
  buildFormulaComparisonAlternatives,
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

  it('usa somente os candidatos da categoria e produtos fixos na comparação', () => {
    const selectedOutsideCategory = material({
      id: 'selected-outside',
      selected: true,
      categories: ['original'],
    });
    const fixedOutsideCategory = material({
      id: 'fixed-outside',
      selected: true,
      minQty: 50,
      maxQty: 50,
      categories: ['original'],
    });
    const categoryCandidate = material({ id: 'candidate', categories: ['comparison'] });

    const result = buildComparisonMaterials({
      available: [selectedOutsideCategory, fixedOutsideCategory, categoryCandidate],
      source: [selectedOutsideCategory, fixedOutsideCategory],
      categoryIds: ['comparison'],
      includeCategoryCandidates: true,
      preserveSourceSelection: false,
    });

    expect(result.filter(({ selected }) => selected).map(({ id }) => id)).toEqual([
      'fixed-outside',
      'candidate',
    ]);
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

  it('gera uma alternativa independente para cada categoria selecionada', () => {
    const filler = material({
      id: 'filler',
      selected: true,
      minQty: 500,
      maxQty: 500,
      price: 1,
    });
    const source = {
      id: 'source',
      formula: '00-10-00',
      selected: true,
      factors: {
        factor: 1,
        discount: 0,
        margin: 0,
        freight: 0,
        taxRate: 0,
        commission: 0,
      },
      macros: [filler],
      micros: [],
      summary: { resultingN: 0, resultingP: 10, resultingK: 0 },
    } as TargetFormula;
    const phosphateA = material({
      id: 'phosphate-a',
      p: 20,
      price: 100,
      categories: ['a'],
    });
    const phosphateB = material({
      id: 'phosphate-b',
      p: 20,
      price: 120,
      categories: ['b'],
    });
    const alternatives = buildFormulaComparisonAlternatives({
      sourceCalculation: source,
      availableMacros: [filler, phosphateA, phosphateB],
      availableMicros: [],
      categories: [
        { id: 'a', nome: 'Categoria A', ordem: 1, ativo: true },
        { id: 'b', nome: 'Categoria B', ordem: 2, ativo: true },
      ],
      selectedCategoryIds: ['a', 'b'],
      reductions: { n: 0, p: 0, k: 0 },
      incompatibilityRules: [],
    });

    expect(alternatives).toHaveLength(2);
    expect(alternatives.every(({ feasible }) => feasible)).toBe(true);
    expect(alternatives.every(({ deviationScore }) => Number.isFinite(deviationScore))).toBe(true);
    expect(alternatives[0].calculation).toMatchObject({
      formula: '0.00-10.00-0.00',
      targetN: 0,
      targetP: 10,
      targetK: 0,
    });
    expect(
      alternatives[0].calculation.macros.find(({ id }) => id === 'phosphate-a')?.quantity
    ).toBe(500);
    expect(
      alternatives[0].calculation.macros.find(({ id }) => id === 'phosphate-b')?.quantity
    ).toBe(0);
    expect(alternatives[1].calculation.summary?.baseCost).toBeGreaterThan(
      alternatives[0].calculation.summary?.baseCost || 0
    );
  });

  it('mantém a categoria inviável no resultado com uma explicação', () => {
    const filler = material({ id: 'filler', selected: true, minQty: 500, maxQty: 500 });
    const alternatives = buildFormulaComparisonAlternatives({
      sourceCalculation: {
        id: 'source',
        formula: '00-10-00',
        selected: true,
        factors: {} as TargetFormula['factors'],
        macros: [filler],
        micros: [],
        summary: { resultingN: 0, resultingP: 10, resultingK: 0 },
      } as TargetFormula,
      availableMacros: [filler],
      availableMicros: [],
      categories: [{ id: 'empty', nome: 'Sem fonte de P', ordem: 1, ativo: true }],
      selectedCategoryIds: ['empty'],
      reductions: { n: 0, p: 0, k: 0 },
      incompatibilityRules: [],
    });

    expect(alternatives[0].feasible).toBe(false);
    expect(alternatives[0].issueMessage).toContain('Não fecha');
  });

  it('cria um novo cartão selecionado com a tonelagem da alternativa sem alterar a origem', () => {
    const sourceFactors = {
      targetFormula: '00-10-00',
      factor: 0.8,
      discount: 10,
      margin: 0,
      freight: 100,
      tipoFrete: 'CIF' as const,
      taxRate: 0,
      commission: 0,
      monthlyInterestRate: 0,
      dueDate: '',
      exemptCurrentMonth: false,
      client: { id: 'client-1', code: '1', name: 'Cliente', document: '' },
      agent: { id: 'agent-1', code: '1', name: 'Agente', document: '' },
      branchId: 'branch-1',
      totalTons: 25,
      priceListId: 'list-1',
      local_carregamento_id: 'location-1',
      priceListCurrency: 'BRL' as const,
    } satisfies TargetFormula['factors'];
    const calculation = {
      id: 'source-comparison-a',
      formula: '00-10-00',
      selected: false,
      targetN: 0,
      targetP: 10,
      targetK: 0,
      factors: sourceFactors,
      macros: [],
      micros: [],
      summary: { resultingN: 0, resultingP: 10, resultingK: 0 },
    } as TargetFormula;
    const alternative = {
      categoryId: 'a',
      categoryName: 'Categoria A',
      feasible: true,
      calculation,
      deviationScore: 0,
    };

    const applied = buildAppliedComparisonCalculation({
      alternative,
      hectares: 100,
      sourceDose: 200,
      targetNutrientsPerHectare: { n: 0, p: 20, k: 0 },
    });

    expect(applied).toMatchObject({
      formula: '00-10-00',
      selected: true,
      factors: {
        totalTons: 20,
        priceListId: 'list-1',
        local_carregamento_id: 'location-1',
        priceListCurrency: 'BRL',
      },
    });
    expect(calculation.selected).toBe(false);
    expect(calculation.factors.totalTons).toBe(25);
  });

  it('não cria cartão para uma alternativa inviável', () => {
    const applied = buildAppliedComparisonCalculation({
      alternative: {
        categoryId: 'invalid',
        categoryName: 'Inválida',
        feasible: false,
        calculation: { summary: undefined } as TargetFormula,
        deviationScore: 0,
      },
      hectares: 100,
      sourceDose: 200,
      targetNutrientsPerHectare: { n: 0, p: 20, k: 0 },
    });

    expect(applied).toBeNull();
  });
});
