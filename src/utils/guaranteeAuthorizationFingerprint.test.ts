import { describe, expect, it } from 'vitest';
import type { TargetFormula } from '../types';
import {
  createGuaranteeAuthorizationFingerprint,
  serializeGuaranteeAuthorizationScope,
} from './guaranteeAuthorizationFingerprint';

const calculation = (quantity = 50): TargetFormula => ({
  id: 'f1', formula: '10-20-30', selected: true, factors: {} as TargetFormula['factors'],
  macros: [{ id: 'm1', selected: true, quantity } as TargetFormula['macros'][number]],
  micros: [], targetCa: 1, targetMicros: { Zn: 0.1, B: 0.2 },
  summary: {
    totalWeight: 1000, baseCost: 0, basePrice: 0, interestValue: 0, taxValue: 0,
    commissionValue: 0, freightValue: 0, finalPrice: 0, totalSaleValue: 0,
    resultingN: 10, resultingP: 20, resultingK: 30, resultingCa: 0.8,
    resultingS: 0, resultingMicros: { B: 0.18, ZN: 0.1 },
  },
});

const divergences = [{
  formulaId: 'f1', formula: '10-20-30', nutrient: 'B', target: 0.2, calculated: 0.18,
}];

describe('guarantee authorization fingerprint', () => {
  it('permanece estável quando apenas a ordem das metas muda', async () => {
    const first = calculation();
    const second = calculation();
    second.targetMicros = { B: 0.2, Zn: 0.1 };

    expect(serializeGuaranteeAuthorizationScope([first], divergences))
      .toBe(serializeGuaranteeAuthorizationScope([second], divergences));
    expect(await createGuaranteeAuthorizationFingerprint([first], divergences))
      .toBe(await createGuaranteeAuthorizationFingerprint([second], divergences));
  });

  it('invalida a assinatura quando a composição é alterada', async () => {
    expect(await createGuaranteeAuthorizationFingerprint([calculation(50)], divergences))
      .not.toBe(await createGuaranteeAuthorizationFingerprint([calculation(51)], divergences));
  });
});
