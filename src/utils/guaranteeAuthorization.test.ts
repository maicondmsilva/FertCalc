import { describe, expect, it } from 'vitest';
import type { TargetFormula, User } from '../types';
import {
  canAuthorizeGuaranteeDivergence,
  formatPricingGuaranteeAuthorizationAudit,
  getGuaranteeDivergences,
  getPricingGuaranteeAuthorizationSummary,
} from './guaranteeAuthorization';

const calculation = (overrides: Partial<TargetFormula> = {}): TargetFormula => ({
  id: 'f1', formula: '10-20-30', selected: true, factors: {} as TargetFormula['factors'],
  macros: [], micros: [], targetCa: 1, targetMicros: { B: 0.2 },
  summary: {
    totalWeight: 1000, baseCost: 0, basePrice: 0, interestValue: 0, taxValue: 0,
    commissionValue: 0, freightValue: 0, finalPrice: 0, totalSaleValue: 0,
    resultingN: 10, resultingP: 19.5, resultingK: 30, resultingCa: 0.8,
    resultingS: 0, resultingMicros: { B: 0.2 },
  }, ...overrides,
});

describe('guarantee divergence authorization', () => {
  it('lista apenas garantias-alvo divergentes', () => {
    const result = getGuaranteeDivergences([calculation()]);
    expect(result.map(({ nutrient }) => nutrient)).toEqual(['P', 'Cálcio (Ca)']);
  });

  it('permite supervisor, administradores ou permissão explícita', () => {
    const user = (role: string, permission = false) => ({
      role,
      permissions: { calculator_overrideGuaranteeDivergence: permission },
    }) as User;
    expect(canAuthorizeGuaranteeDivergence(user('manager'))).toBe(true);
    expect(canAuthorizeGuaranteeDivergence(user('admin'))).toBe(true);
    expect(canAuthorizeGuaranteeDivergence(user('user', true))).toBe(true);
    expect(canAuthorizeGuaranteeDivergence(user('user'))).toBe(false);
  });

  it('resume autorizações gravadas nas fórmulas da precificação', () => {
    const authorization = {
      authorizedByUserId: 'u1', authorizedByUserName: 'Supervisor',
      authorizedAt: '2026-09-22T12:00:00.000Z', justification: 'Ajuste aprovado',
      divergences: [{ nutrient: 'B', target: 0.2, calculated: 0.18 }],
    };
    const summary = getPricingGuaranteeAuthorizationSummary({
      calculations: [calculation({ guaranteeDivergenceAuthorization: authorization })],
    } as unknown as import('../types').PricingRecord);

    expect(summary.hasAuthorizedDivergence).toBe(true);
    expect(summary.authorizedFormulaCount).toBe(1);
    expect(summary.divergenceCount).toBe(1);
    expect(summary.latestAuthorization?.authorizedByUserName).toBe('Supervisor');
  });

  it('formata a trilha completa de autorização para relatórios e auditoria', () => {
    const authorization = {
      authorizedByUserId: 'u1', authorizedByUserName: 'Supervisor',
      authorizedAt: '2026-09-22T12:00:00.000Z', justification: 'Ajuste aprovado',
      divergences: [{ nutrient: 'B', target: 0.2, calculated: 0.18 }],
    };
    const pricing = {
      calculations: [calculation({ formula: '10-20-30', guaranteeDivergenceAuthorization: authorization })],
    } as unknown as import('../types').PricingRecord;

    const audit = formatPricingGuaranteeAuthorizationAudit(pricing);

    expect(audit).toContain('10-20-30: Supervisor');
    expect(audit).toContain('Ajuste aprovado');
    expect(audit).toContain('(B)');
    expect(formatPricingGuaranteeAuthorizationAudit({ calculations: [] } as unknown as import('../types').PricingRecord))
      .toBe('Sem exceção');
  });
});
