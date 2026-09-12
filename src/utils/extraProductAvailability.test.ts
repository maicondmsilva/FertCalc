import { describe, expect, it } from 'vitest';
import { isExtraProductAvailableAtLocation } from './extraProductAvailability';

describe('isExtraProductAvailableAtLocation', () => {
  it('libera o produto somente no local configurado', () => {
    const product = {
      availableInCalculatorWithoutPriceList: true,
      extraLoadingLocationIds: ['uberaba', 'araxa'],
    };

    expect(isExtraProductAvailableAtLocation(product, 'uberaba')).toBe(true);
    expect(isExtraProductAvailableAtLocation(product, 'patos')).toBe(false);
  });

  it('não libera produto sem local selecionado ou com a opção desmarcada', () => {
    expect(
      isExtraProductAvailableAtLocation(
        { availableInCalculatorWithoutPriceList: true, extraLoadingLocationIds: [] },
        'uberaba'
      )
    ).toBe(false);
    expect(
      isExtraProductAvailableAtLocation(
        { availableInCalculatorWithoutPriceList: false, extraLoadingLocationIds: ['uberaba'] },
        'uberaba'
      )
    ).toBe(false);
  });

  it('preserva temporariamente o comportamento antigo sem dados da migration', () => {
    expect(
      isExtraProductAvailableAtLocation({ availableInCalculatorWithoutPriceList: true }, 'uberaba')
    ).toBe(true);
  });
});
