import { describe, expect, it } from 'vitest';
import type { TargetFormula, User } from '../types';
import {
  buildGuaranteeAuthorizationAuditMetadata,
  canAuthorizeGuaranteeDivergence,
  formatPricingGuaranteeAuthorizationAudit,
  getGuaranteeDivergences,
  getPricingGuaranteeAuthorizationSummary,
} from './guaranteeAuthorization';

const calculation = (overrides: Partial<TargetFormula> = {}): TargetFormula => ({
  id: 'f1',
  formula: '10-20-30',
  selected: true,
  factors: {} as TargetFormula['factors'],
  macros: [],
  micros: [],
  targetCa: 1,
  targetMicros: { B: 0.2 },
  summary: {
    totalWeight: 1000,
    baseCost: 0,
    basePrice: 0,
    interestValue: 0,
    taxValue: 0,
    commissionValue: 0,
    freightValue: 0,
    finalPrice: 0,
    totalSaleValue: 0,
    resultingN: 10,
    resultingP: 19.5,
    resultingK: 30,
    resultingCa: 0.8,
    resultingS: 0,
    resultingMicros: { B: 0.2 },
  },
  ...overrides,
});

describe('guarantee divergence authorization', () => {
  it('lista apenas garantias-alvo divergentes', () => {
    const result = getGuaranteeDivergences([calculation()]);
    expect(result.map(({ nutrient }) => nutrient)).toEqual(['P', 'Cálcio (Ca)']);
  });

  it('aceita o N-P-K até 0,98 acima do alvo sem pedir autorização', () => {
    const summary = calculation().summary!;
    const withinRange = calculation({
      formula: '05-25-15',
      targetCa: 2,
      targetMicros: {},
      summary: { ...summary, resultingN: 5.98, resultingP: 25.4, resultingK: 15, resultingCa: 2.6 },
    });
    expect(getGuaranteeDivergences([withinRange])).toEqual([]);

    const aboveRange = calculation({
      formula: '05-25-15',
      targetCa: 2,
      targetMicros: {},
      summary: { ...summary, resultingN: 6.1, resultingP: 24.9, resultingK: 15, resultingCa: 3 },
    });
    expect(getGuaranteeDivergences([aboveRange]).map(({ nutrient }) => nutrient)).toEqual([
      'N',
      'P',
      'Cálcio (Ca)',
    ]);
  });

  it('permite supervisor, administradores ou permissão explícita', () => {
    const user = (role: string, permission = false) =>
      ({
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
      authorizedByUserId: 'u1',
      authorizedByUserName: 'Supervisor',
      authorizedAt: '2026-09-22T12:00:00.000Z',
      justification: 'Ajuste aprovado',
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
      authorizedByUserId: 'u1',
      authorizedByUserName: 'Supervisor',
      authorizedAt: '2026-09-22T12:00:00.000Z',
      justification: 'Ajuste aprovado',
      divergences: [{ nutrient: 'B', target: 0.2, calculated: 0.18 }],
    };
    const pricing = {
      calculations: [
        calculation({ formula: '10-20-30', guaranteeDivergenceAuthorization: authorization }),
      ],
    } as unknown as import('../types').PricingRecord;

    const audit = formatPricingGuaranteeAuthorizationAudit(pricing);

    expect(audit).toContain('10-20-30: Supervisor');
    expect(audit).toContain('Ajuste aprovado');
    expect(audit).toContain('(B)');
    expect(
      formatPricingGuaranteeAuthorizationAudit({
        calculations: [],
      } as unknown as import('../types').PricingRecord)
    ).toBe('Sem exceção');
  });

  it('gera metadados estruturados para a auditoria administrativa', () => {
    const authorization = {
      authorizedByUserId: 'u1',
      authorizedByUserName: 'Supervisor',
      authorizedAt: '2026-09-22T12:00:00.000Z',
      justification: 'Ajuste aprovado',
      divergences: [
        { nutrient: 'B', target: 0.2, calculated: 0.18 },
        { nutrient: 'Zn', target: 0.1, calculated: 0.08 },
      ],
    };

    const metadata = buildGuaranteeAuthorizationAuditMetadata([
      calculation({ guaranteeDivergenceAuthorization: authorization }),
      calculation({ id: 'f2', formula: '20-00-20', guaranteeDivergenceAuthorization: undefined }),
    ]);

    expect(metadata.authorized_formula_count).toBe(1);
    expect(metadata.divergence_count).toBe(2);
    expect(metadata.formulas[0]).toMatchObject({
      formula_id: 'f1',
      authorized_by_user_name: 'Supervisor',
      justification: 'Ajuste aprovado',
    });
  });
});
