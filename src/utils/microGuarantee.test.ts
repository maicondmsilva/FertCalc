import { describe, expect, it } from 'vitest';
import { microGuaranteePercentToKg, microKgToGuaranteePercent } from './microGuarantee';

describe('conversão de micronutriente', () => {
  it('converte uma garantia desejada em kg', () => {
    expect(microGuaranteePercentToKg(0.25, 5)).toBe(50);
  });

  it('converte kg na garantia final', () => {
    expect(microKgToGuaranteePercent(50, 5)).toBe(0.25);
  });
});
