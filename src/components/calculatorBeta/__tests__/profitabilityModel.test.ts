import { describe, expect, it } from 'vitest';
import {
  addDaysToDate,
  canCheckProfitability,
  contextFromCalculation,
  parseDecimal,
  profitabilityProblem,
  profitabilityTone,
  toProfitabilityInput,
} from '../profitabilityModel';
import { sanitizePricingSearchTerm } from '../../../utils/postgrestSearch';

describe('profitabilityModel', () => {
  it('permissão igual à do banco', () => {
    expect(canCheckProfitability({ role: 'manager', permissions: {} } as never)).toBe(true);
    expect(canCheckProfitability({ role: 'user', permissions: {} } as never)).toBe(false);
    expect(
      canCheckProfitability({
        role: 'comercial',
        permissions: { calculator_profitabilityCheck: true },
      } as never)
    ).toBe(true);
  });

  it('lê números com vírgula, milhar e ponto', () => {
    expect(parseDecimal('1.234,56')).toBe(1234.56);
    expect(parseDecimal('12,5')).toBe(12.5);
    expect(parseDecimal('12.5')).toBe(12.5);
    expect(parseDecimal('abc')).toBe(0);
  });

  it('soma dias à data', () => {
    expect(addDaysToDate('2026-11-25', 30)).toBe('2026-12-25');
    expect(addDaysToDate('', 30)).toBe('');
  });

  it('preenche com o preço calculado e não desconta frete FOB', () => {
    const { form, baseCost, currency } = contextFromCalculation({
      factors: { factor: 1.1, taxRate: 4, commission: 2, freight: 80, tipoFrete: 'FOB' } as never,
      summary: { baseCost: 2000, finalPrice: 2650.5 } as never,
    });
    expect(form.unitaryPrice).toBe('2650,50');
    expect(form.freight).toBe('0');
    expect(baseCost).toBe(2000);
    expect(currency).toBe('BRL');
    expect(toProfitabilityInput(form, baseCost)).toMatchObject({
      unitaryPrice: 2650.5,
      factor: 1.1,
      taxRate: 4,
      commissionRate: 2,
    });
  });

  it('aponta o que falta antes de calcular', () => {
    const { form } = contextFromCalculation({ summary: { baseCost: 0, finalPrice: 0 } as never });
    expect(profitabilityProblem(form, 0)).toMatch(/valor de venda/);
    expect(profitabilityProblem({ ...form, unitaryPrice: '100' }, 0)).toMatch(/custo base/);
    expect(profitabilityProblem({ ...form, unitaryPrice: '100' }, 50)).toMatch(/vencimento/);
    expect(
      profitabilityProblem({ ...form, unitaryPrice: '100', dueDate: '2026-12-01' }, 50)
    ).toBeNull();
    expect(
      profitabilityProblem(
        { ...form, unitaryPrice: '100', dueDate: '2026-12-01', taxRate: '150' },
        50
      )
    ).toMatch(/entre 0 e 100/);
  });

  it('faixas de cor', () => {
    expect(profitabilityTone(-1)).toBe('loss');
    expect(profitabilityTone(3)).toBe('low');
    expect(profitabilityTone(12)).toBe('good');
  });

  it('busca não injeta filtros no PostgREST', () => {
    expect(sanitizePricingSearchTerm('abc),id.neq.(x')).toBe('abc id.neq. x');
    expect(sanitizePricingSearchTerm('  Fazenda   Boa*Vista% ')).toBe('Fazenda Boa Vista');
  });
});
