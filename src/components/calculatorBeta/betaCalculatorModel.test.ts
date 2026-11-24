import { describe, expect, it } from 'vitest';
import type { RawMaterial, SavedFormula, TargetFormula } from '../../types';
import {
  applyMagnesiumTarget,
  applySavedFormulaToCalculation,
  buildCompositionTable,
  composeFormulaTarget,
  filterPriceLists,
  findProductsMatchingNpk,
  getFormulaMagnesiumTarget,
  getPriceListCurrency,
  getNutrientStatus,
  isSameFormulaTarget,
  isValidNutrientInput,
  splitFormulaTarget,
} from './betaCalculatorModel';

const material = (overrides: Partial<RawMaterial> = {}): RawMaterial => ({
  id: 'map',
  type: 'macro',
  name: 'MAP 11-52',
  price: 4150,
  n: 11,
  p: 52,
  k: 0,
  s: 0,
  ca: 0,
  microGuarantees: [],
  minQty: 0,
  maxQty: 0,
  selected: true,
  quantity: 0,
  ...overrides,
});

const calculation = (overrides: Partial<TargetFormula> = {}): TargetFormula =>
  ({
    id: 'f1',
    formula: '04-14-08',
    selected: true,
    macros: [],
    micros: [],
    factors: {},
    ...overrides,
  }) as TargetFormula;

describe('composição da batida', () => {
  it('lista só os produtos usados, ordena pelo valor e soma o custo base', () => {
    const table = buildCompositionTable({
      macros: [
        material({ quantity: 230 }),
        material({ id: 'calc', name: 'Calcário', price: 350, quantity: 750 }),
        material({ id: 'ureia', name: 'Ureia', quantity: 0 }),
      ],
      micros: [
        material({ id: 'ulex', type: 'micro', name: 'Ulexita', price: 5200, quantity: 20 }),
        material({ id: 'off', name: 'Desmarcado', selected: false, quantity: 50 }),
      ],
    });

    expect(table.rows.map((row) => row.id)).toEqual(['map', 'calc', 'ulex']);
    expect(table.rows[0].value).toBeCloseTo(954.5, 6);
    expect(table.rows[0].percent).toBeCloseTo(23, 6);
    expect(table.totalQuantity).toBe(1000);
    expect(table.totalValue).toBeCloseTo(954.5 + 262.5 + 104, 6);
  });
});

describe('campos N-P-K', () => {
  it('separa e junta a fórmula sem perder decimais', () => {
    expect(splitFormulaTarget('04-14-08')).toEqual({ n: '04', p: '14', k: '08' });
    expect(splitFormulaTarget('4,5-10-10 + Zn')).toEqual({ n: '4,5', p: '10', k: '10' });
    expect(splitFormulaTarget('')).toEqual({ n: '', p: '', k: '' });
    expect(composeFormulaTarget({ n: '4', p: '14', k: '8' })).toBe('04-14-08');
    expect(composeFormulaTarget({ n: '4,5', p: '', k: '' })).toBe('4,5-00-00');
    expect(composeFormulaTarget({ n: '', p: '', k: '' })).toBe('');
  });

  it('aceita apenas números com até duas casas', () => {
    expect(isValidNutrientInput('14')).toBe(true);
    expect(isValidNutrientInput('4,5')).toBe(true);
    expect(isValidNutrientInput('')).toBe(true);
    expect(isValidNutrientInput('abc')).toBe(false);
    expect(isValidNutrientInput('123')).toBe(false);
  });

  it('classifica a garantia obtida em relação ao alvo', () => {
    expect(getNutrientStatus(0, 4)).toBe('none');
    expect(getNutrientStatus(4, undefined)).toBe('pending');
    expect(getNutrientStatus(4, 4.03)).toBe('met');
    expect(getNutrientStatus(4, 4.6)).toBe('above');
    expect(getNutrientStatus(4, 3.5)).toBe('below');
    // N-P-K: até 0,98 acima do alvo ainda está no alvo.
    expect(getNutrientStatus(5, 5.98, 0.98)).toBe('met');
    expect(getNutrientStatus(5, 6.1, 0.98)).toBe('above');
    expect(getNutrientStatus(5, 4.9, 0.98)).toBe('below');
  });
});

describe('digitação com casas decimais', () => {
  it('mantém a vírgula enquanto a casa decimal ainda não foi digitada', () => {
    const draft = { n: '4,', p: '14', k: '08' };
    const formula = composeFormulaTarget(draft);
    expect(formula).toBe('04-14-08');
    // O campo não é reescrito para "04", então a vírgula continua lá.
    expect(isSameFormulaTarget(draft, formula)).toBe(true);
  });

  it('aceita duas casas após a vírgula', () => {
    const draft = { n: '4,25', p: '14', k: '8,5' };
    expect(isValidNutrientInput('4,25')).toBe(true);
    expect(isValidNutrientInput('4,255')).toBe(false);
    expect(composeFormulaTarget(draft)).toBe('4,25-14-8,5');
    expect(isSameFormulaTarget(draft, '4,25-14-8,5')).toBe(true);
    expect(isSameFormulaTarget(draft, '04-14-08')).toBe(false);
  });
});

describe('sugestão de batidas pelo N-P-K', () => {
  const products = [
    { id: 'a', ativo: true, formula_npk: '04-14-08' },
    { id: 'b', ativo: true, formula_npk: '04-30-10 + Zn' },
    { id: 'c', ativo: true, formula_npk: '20-00-20' },
    { id: 'd', ativo: false, formula_npk: '04-14-08' },
    { id: 'e', ativo: true, formula_npk: 'sem fórmula' },
  ];

  it('filtra conforme os campos digitados', () => {
    expect(findProductsMatchingNpk(products, { n: '', p: '', k: '' })).toEqual([]);
    expect(findProductsMatchingNpk(products, { n: '4', p: '', k: '' }).map((p) => p.id)).toEqual([
      'a',
      'b',
    ]);
    expect(findProductsMatchingNpk(products, { n: '04', p: '14', k: '' }).map((p) => p.id)).toEqual(
      ['a']
    );
    expect(
      findProductsMatchingNpk(products, { n: '4,', p: '30', k: '10' }).map((p) => p.id)
    ).toEqual(['b']);
  });
});

describe('magnésio', () => {
  it('grava a meta própria e uma cópia entre os micros, sem duplicar nomes', () => {
    const result = applyMagnesiumTarget(calculation({ targetMicros: { Magnésio: 2, B: 0.1 } }), 1);
    expect(result).toEqual({ targetMg: 1, targetMicros: { B: 0.1, Mg: 1 } });
    expect(applyMagnesiumTarget(calculation({ targetMicros: { Mg: 1 } }), 0)).toEqual({
      targetMg: undefined,
      targetMicros: {},
    });
  });

  it('lê a meta de Mg de batidas antigas gravadas entre os micros', () => {
    expect(getFormulaMagnesiumTarget({ targetMicros: { Mg: 1.5 } })).toBe(1.5);
    expect(getFormulaMagnesiumTarget({ targetMg: 2, targetMicros: { Mg: 1.5 } })).toBe(2);
  });
});

describe('carregar batida salva', () => {
  it('restaura a composição mantendo os preços atuais da lista', () => {
    const current = calculation({
      macros: [material({ price: 4300, selected: false })],
      micros: [material({ id: 'ulex', type: 'micro', name: 'Ulexita', selected: true })],
    });
    const saved = {
      id: 'sf1',
      targetFormula: '04-14-08',
      category: 'all',
      targetCa: 2,
      targetS: 5,
      targetMicros: { Mg: 1, B: 0.1 },
      macros: [material({ price: 3000, selected: true, quantity: 230, minQty: 50 })],
      micros: [],
    } as unknown as SavedFormula;

    const result = applySavedFormulaToCalculation(current, saved, '04-14-08');

    expect(result.savedFormulaId).toBe('sf1');
    expect(result.targetMg).toBe(1);
    expect(result.macros[0]).toMatchObject({
      selected: true,
      quantity: 230,
      minQty: 50,
      price: 4300,
    });
    expect(result.micros[0]).toMatchObject({ selected: false, quantity: 0 });
    expect(result.summary).toBeUndefined();
  });
});

describe('filtro de listas de preço por moeda', () => {
  const brlItem = [material({ id: 'map', price: 7900 })];
  const dualItem = [material({ id: 'map', price: 7900, priceUSD: 1460 })];
  const lists = [
    {
      id: 'brl-antiga',
      currency: 'BRL' as const,
      local_carregamento_id: 'l1',
      date: '2026-01-01',
      macros: brlItem,
      micros: [],
    },
    {
      id: 'brl-nova',
      currency: undefined,
      local_carregamento_id: 'l1',
      date: '2026-06-01',
      macros: brlItem,
      micros: [],
    },
    {
      id: 'dupla',
      currency: 'BRL' as const,
      local_carregamento_id: 'l1',
      date: '2026-05-01',
      macros: dualItem,
      micros: [],
    },
    {
      id: 'usd-antiga',
      currency: 'USD' as const,
      local_carregamento_id: 'l2',
      date: '2026-07-01',
      macros: brlItem,
      micros: [],
    },
  ];

  it('lista sem moeda conta como reais', () => {
    expect(getPriceListCurrency({ currency: undefined })).toBe('BRL');
    expect(getPriceListCurrency({ currency: 'USD' })).toBe('USD');
  });

  it('mostra as listas com preço na moeda escolhida, da mais recente à mais antiga', () => {
    expect(filterPriceLists(lists, { currency: 'BRL' }).map((list) => list.id)).toEqual([
      'brl-nova',
      'dupla',
      'brl-antiga',
    ]);
    // A lista com reais e dólar aparece nas duas moedas.
    expect(filterPriceLists(lists, { currency: 'USD' }).map((list) => list.id)).toEqual([
      'usd-antiga',
      'dupla',
    ]);
  });

  it('combina moeda e local de carregamento', () => {
    expect(
      filterPriceLists(lists, { currency: 'USD', localId: 'l1' }).map((list) => list.id)
    ).toEqual(['dupla']);
  });
});
