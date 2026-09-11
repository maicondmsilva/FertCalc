import { describe, expect, it } from 'vitest';
import type { PricingRecord } from '../types';
import {
  formatPricingSummaryMoney,
  getPricingRecordCurrencies,
  getPricingSummaryMoneyBRL,
  getPricingTotalSaleValueBRL,
} from './pricingCurrency';

const pricing = {
  factors: {},
  summary: {},
  calculations: [
    {
      factors: { priceListCurrency: 'USD', appliedExchangeRate: 5.2, totalTons: 10 },
      summary: { currency: 'USD', exchangeRate: 5.2, finalPrice: 100, totalSaleValue: 1000 },
    },
    {
      factors: { priceListCurrency: 'BRL', totalTons: 5 },
      summary: { currency: 'BRL', finalPrice: 500, totalSaleValue: 2500 },
    },
  ],
} as PricingRecord;

describe('moeda de precificação', () => {
  it('converte valores USD para BRL usando o câmbio aplicado', () => {
    const calculation = pricing.calculations![0];
    expect(getPricingSummaryMoneyBRL(calculation.summary, calculation.factors, 'finalPrice')).toBe(
      520
    );
    expect(
      formatPricingSummaryMoney(calculation.summary, calculation.factors, 'finalPrice')
    ).toContain('US$');
    expect(
      formatPricingSummaryMoney(calculation.summary, calculation.factors, 'finalPrice')
    ).toContain('R$');
  });

  it('soma relatórios mistos exclusivamente em BRL', () => {
    expect(getPricingRecordCurrencies(pricing)).toEqual(['USD', 'BRL']);
    expect(getPricingTotalSaleValueBRL(pricing)).toBe(7700);
  });
});
