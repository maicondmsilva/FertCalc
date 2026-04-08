import { describe, it, expect } from 'vitest';
import { calculateSummary, buildSolverModel, applyResultsToMaterials } from './calculationUtils';
import type { RawMaterial, PricingFactors } from '../types';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function makeMacro(overrides: Partial<RawMaterial> = {}): RawMaterial {
  return {
    id: 'mat-1',
    type: 'macro',
    name: 'Ureia',
    price: 2000, // R$/ton
    n: 45,
    p: 0,
    k: 0,
    s: 0,
    ca: 0,
    microGuarantees: [],
    minQty: 0,
    maxQty: 1000,
    selected: true,
    quantity: 400, // kg
    ...overrides,
  };
}

function makeFactors(overrides: Partial<PricingFactors> = {}): PricingFactors {
  return {
    targetFormula: '45-00-00',
    factor: 1,
    discount: 0,
    margin: 0,
    freight: 0,
    taxRate: 0,
    commission: 0,
    monthlyInterestRate: 0,
    dueDate: '',
    exemptCurrentMonth: false,
    client: { id: 'c1', code: '1', name: 'Fazenda X', document: '123' },
    agent: { id: 'a1', code: '1', name: 'Agente Y', document: '456' },
    branchId: 'b1',
    priceListId: 'pl1',
    totalTons: 0,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// calculateSummary
// ─────────────────────────────────────────────────────────────
describe('calculateSummary', () => {
  it('retorna zeros quando não há materiais selecionados', () => {
    const macro = makeMacro({ selected: false });
    const result = calculateSummary([macro], [], makeFactors());
    expect(result.totalWeight).toBe(0);
    expect(result.baseCost).toBe(0);
    expect(result.finalPrice).toBe(0);
  });

  it('calcula custo base corretamente para 1 macro', () => {
    // 400 kg de Ureia a R$ 2.000/ton => custo = (400/1000) * 2000 = R$ 800
    const macro = makeMacro({ quantity: 400, price: 2000 });
    const result = calculateSummary([macro], [], makeFactors());
    expect(result.totalWeight).toBe(400);
    expect(result.baseCost).toBeCloseTo(800);
  });

  it('calcula garantias NPK corretamente', () => {
    // Ureia: 45% N, 400 kg total
    const macro = makeMacro({ quantity: 400, n: 45 });
    const result = calculateSummary([macro], [], makeFactors());
    expect(result.resultingN).toBeCloseTo(45);
    expect(result.resultingP).toBe(0);
    expect(result.resultingK).toBe(0);
  });

  it('calcula preço final com fator de custo diferente de 1', () => {
    // factor = 0.8 => basePrice = baseCost / 0.8
    const macro = makeMacro({ quantity: 400, price: 2000 });
    const factors = makeFactors({ factor: 0.8 });
    const result = calculateSummary([macro], [], factors);
    expect(result.baseCost).toBeCloseTo(800);
    expect(result.basePrice).toBeCloseTo(1000); // 800 / 0.8
  });

  it('aplica taxa de juros corretamente', () => {
    const macro = makeMacro({ quantity: 1000, price: 1000 });
    const factors = makeFactors({ factor: 1, monthlyInterestRate: 0.02 }); // 2% ao mês
    const result = calculateSummary([macro], [], factors);
    // baseCost = (1000/1000) * 1000 = 1000; basePrice = 1000
    // interestValue = 1000 * 0.02 = 20
    expect(result.interestValue).toBeCloseTo(20);
  });

  it('aplica imposto, comissão e frete corretamente', () => {
    const macro = makeMacro({ quantity: 1000, price: 1000 });
    const factors = makeFactors({
      factor: 1,
      taxRate: 0.05, // 5%
      commission: 0.03, // 3%
      freight: 50, // R$ fixo
    });
    const result = calculateSummary([macro], [], factors);
    // basePrice = 1000, taxValue = 50, commissionValue = 30, freightValue = 50
    expect(result.taxValue).toBeCloseTo(50);
    expect(result.commissionValue).toBeCloseTo(30);
    expect(result.freightValue).toBe(50);
    expect(result.finalPrice).toBeCloseTo(1130); // 1000 + 50 + 30 + 50
  });

  it('calcula valor total de venda com totalTons', () => {
    const macro = makeMacro({ quantity: 1000, price: 1000 });
    const factors = makeFactors({ factor: 1, totalTons: 10 });
    const result = calculateSummary([macro], [], factors);
    expect(result.totalSaleValue).toBeCloseTo(result.finalPrice * 10);
  });

  it('combina múltiplos materiais corretamente', () => {
    const ureia = makeMacro({
      id: 'u1',
      name: 'Ureia',
      n: 45,
      p: 0,
      k: 0,
      quantity: 500,
      price: 2000,
    });
    const kcl = makeMacro({
      id: 'kcl',
      name: 'KCl',
      n: 0,
      p: 0,
      k: 60,
      quantity: 500,
      price: 1500,
    });
    const result = calculateSummary([ureia, kcl], [], makeFactors());
    expect(result.totalWeight).toBe(1000);
    // custo = (500/1000)*2000 + (500/1000)*1500 = 1000 + 750 = 1750
    expect(result.baseCost).toBeCloseTo(1750);
    // N%: (500 * 0.45) / 1000 * 100 = 22.5%
    expect(result.resultingN).toBeCloseTo(22.5);
    // K%: (500 * 0.60) / 1000 * 100 = 30%
    expect(result.resultingK).toBeCloseTo(30);
  });

  it('inclui micronutrientes no cálculo de garantias', () => {
    const micro = makeMacro({
      id: 'zn1',
      type: 'micro',
      name: 'Zinco',
      n: 0,
      p: 0,
      k: 0,
      quantity: 100,
      microGuarantees: [{ name: 'Zn', value: 20 }],
    });
    const result = calculateSummary([], [micro], makeFactors());
    expect(result.resultingMicros['Zn']).toBeCloseTo(20); // (100 * 0.20)/100 * 100 = 20%
  });

  it('não divide por zero quando totalWeight é zero', () => {
    const macro = makeMacro({ selected: true, quantity: 0 });
    const result = calculateSummary([macro], [], makeFactors());
    expect(result.resultingN).toBe(0);
    expect(result.resultingP).toBe(0);
    expect(result.resultingK).toBe(0);
  });

  it('não divide por zero quando factor é zero', () => {
    const macro = makeMacro({ quantity: 400, price: 2000 });
    const factors = makeFactors({ factor: 0 });
    const result = calculateSummary([macro], [], factors);
    // factor=0 deve retornar baseCost sem divisão (fallback)
    expect(isNaN(result.basePrice)).toBe(false);
    expect(isFinite(result.basePrice)).toBe(true);
  });

  it('fecha garantias dentro de ±0,05 para fórmula 16-07-23', () => {
    const kcl = makeMacro({ id: 'kcl', n: 0, p: 0, k: 60, quantity: 383.33 });
    const nitrato = makeMacro({ id: 'nit', n: 34, p: 0, k: 0, quantity: 338.24 });
    const sam = makeMacro({ id: 'sam', n: 21, p: 0, k: 0, quantity: 143.9 });
    const map = makeMacro({ id: 'map', n: 11, p: 52, k: 0, quantity: 134.53 });
    const result = calculateSummary([kcl, nitrato, sam, map], [], makeFactors());
    expect(result.totalWeight).toBeCloseTo(1000, 0);
    expect(result.resultingN).toBeCloseTo(16, 1);
    expect(result.resultingP).toBeCloseTo(7, 1);
    expect(result.resultingK).toBeCloseTo(23, 1);
  });
});

// ─────────────────────────────────────────────────────────────
// buildSolverModel
// ─────────────────────────────────────────────────────────────
describe('buildSolverModel', () => {
  it('cria um modelo LP com opType min por padrão', () => {
    const model = buildSolverModel({ n: { min: 10 } }, { mat1: { cost: 1, n: 45 } });
    expect(model.opType).toBe('min');
    expect(model.optimize).toBe('cost');
    expect(model.constraints).toHaveProperty('n');
    expect(model.variables).toHaveProperty('mat1');
  });

  it('permite sobrescrever a chave de otimização', () => {
    const model = buildSolverModel({}, {}, 'price');
    expect(model.optimize).toBe('price');
  });

  it('retorna objeto ints vazio', () => {
    const model = buildSolverModel();
    expect(model.ints).toEqual({});
  });
});

// ─────────────────────────────────────────────────────────────
// applyResultsToMaterials
// ─────────────────────────────────────────────────────────────
describe('applyResultsToMaterials', () => {
  it('atualiza a quantidade dos materiais com resultados do solver', () => {
    const materials: RawMaterial[] = [
      makeMacro({ id: 'u1', quantity: 0 }),
      makeMacro({ id: 'kcl', quantity: 0 }),
    ];
    const results = { u1: 350, kcl: 150 };
    const updated = applyResultsToMaterials(results, materials);
    expect(updated[0].quantity).toBe(350);
    expect(updated[1].quantity).toBe(150);
  });

  it('define quantity como 0 quando id não está nos resultados', () => {
    const materials: RawMaterial[] = [makeMacro({ id: 'u1', quantity: 200 })];
    const updated = applyResultsToMaterials({}, materials);
    expect(updated[0].quantity).toBe(0);
  });

  it('não muta os materiais originais', () => {
    const materials: RawMaterial[] = [makeMacro({ id: 'u1', quantity: 100 })];
    const results = { u1: 999 };
    applyResultsToMaterials(results, materials);
    expect(materials[0].quantity).toBe(100); // original não alterado
  });
});
