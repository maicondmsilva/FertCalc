import { describe, expect, it } from 'vitest';
import type { RawMaterial } from '../types';
import { buildGuaranteeBreakdown } from './guaranteeBreakdown';
import { calculateMaterialComposition } from '../domain/pricing-engine/pricingEngine';

const m = (patch: Partial<RawMaterial>) =>
  ({
    id: patch.name,
    type: 'macro',
    n: 0,
    p: 0,
    k: 0,
    s: 0,
    ca: 0,
    price: 0,
    selected: true,
    microGuarantees: [],
    ...patch,
  }) as RawMaterial;

const kcl = m({
  name: 'KCL',
  k: 60,
  quantity: 250,
  microGuarantees: [
    { name: 'B', value: 1 },
    { name: 'ZINCO', value: 2 },
  ],
});
const ureia = m({ name: 'Ureia', n: 45, quantity: 300 });
const boro = m({
  name: 'Ulexita',
  type: 'micro',
  quantity: 50,
  microGuarantees: [{ name: 'Boro', value: 10 }],
});
const enchimento = m({ name: 'Enchimento', quantity: 400, ca: 20 });
const desmarcado = m({ name: 'Fora', n: 46, quantity: 0 });

describe('soma das garantias na batida', () => {
  const rows = buildGuaranteeBreakdown([kcl, ureia, boro, enchimento, desmarcado], {
    n: 10,
    p: 0,
    k: 15,
    micros: { B: 0.6, Cu: 0.1 },
  });
  const row = (label: string) => rows.find((item) => item.label === label)!;

  it('soma cada garantia, inclusive micros dentro do macro', () => {
    expect(row('N').obtained).toBeCloseTo(13.5);
    expect(row('K').obtained).toBeCloseTo(15);
    expect(row('Ca').obtained).toBeCloseTo(8);
    expect(row('B').obtained).toBeCloseTo(0.75); // 0,25 (KCL) + 0,5 (Ulexita)
    expect(row('Zn').obtained).toBeCloseTo(0.5); // só do KCL, sem meta
    expect(row('Zn').target).toBe(0);
  });

  it('mostra de onde vem cada garantia, maior primeiro', () => {
    expect(row('B').contributions.map((c) => [c.name, Number(c.percent.toFixed(2))])).toEqual([
      ['Ulexita', 0.5],
      ['KCL', 0.25],
    ]);
  });

  it('meta sem fonte aparece com zero; nutriente sem meta e sem fonte não aparece', () => {
    expect(row('Cu')).toMatchObject({ obtained: 0, target: 0.1, contributions: [] });
    expect(rows.find((item) => item.label === 'P')).toBeUndefined();
    expect(rows.find((item) => item.label === 'Mg')).toBeUndefined();
  });

  it('ordem: N, K (primários), Ca (secundário), depois micros em ordem alfabética', () => {
    expect(rows.map((item) => item.label)).toEqual(['N', 'K', 'Ca', 'B', 'Cu', 'Zn']);
  });

  it('bate com o cálculo do motor', () => {
    const engine = calculateMaterialComposition([kcl, ureia, enchimento, desmarcado], [boro]);
    expect(row('N').obtained).toBeCloseTo(engine.resultingN);
    expect(row('B').obtained).toBeCloseTo(engine.resultingMicros.B);
  });
});
