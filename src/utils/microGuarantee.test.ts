import { describe, expect, it } from 'vitest';
import {
  microGuaranteePercentToKg,
  microKgToGuaranteePercent,
  roundMicroValue,
} from './microGuarantee';

describe('conversão de micronutriente', () => {
  it('converte uma garantia desejada em kg', () => {
    expect(microGuaranteePercentToKg(0.25, 5)).toBe(50);
  });

  it('converte kg na garantia final', () => {
    expect(microKgToGuaranteePercent(50, 5)).toBe(0.25);
  });

  it('arredonda a quantidade calculada para duas casas decimais', () => {
    expect(microGuaranteePercentToKg(0.33, 7)).toBe(47.14);
    expect(roundMicroValue(12.345)).toBe(12.35);
  });
});
