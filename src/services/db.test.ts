import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PricingRecord, TargetFormula } from '../types';

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('./supabase', () => ({
  supabase: { from: fromMock },
}));

import {
  createPricingRecord,
  getPricingRecords,
  normalizeCalculationsForDb,
  updatePricingRecord,
} from './db';

beforeEach(() => {
  fromMock.mockReset();
});

describe('normalizeCalculationsForDb', () => {
  it('normalizes free product calculations with missing formula/summary fields', () => {
    const freeProductCalc: Partial<TargetFormula> = {
      modo_calculo: 'produtos_livres',
      produtos_livres: [{ productId: 'p1', quantity: 500 }],
      macros: [{ id: 'p1', quantity: 500, price: 1200 } as TargetFormula['macros'][number]],
      micros: [],
    };

    const calculations = normalizeCalculationsForDb([
      freeProductCalc as NonNullable<Parameters<typeof normalizeCalculationsForDb>[0]>[number],
    ]);

    expect(calculations[0].formula).toBe('Produtos Livres');
    expect(calculations[0].summary).toMatchObject({
      totalWeight: 500,
      baseCost: 600,
      finalPrice: 600,
      resultingN: 0,
      resultingP: 0,
      resultingK: 0,
    });
  });
});

describe('pricing record persistence', () => {
  const record = {
    organizationId: 'organization-1',
    userId: 'user-1',
    userName: 'Usuário',
    userCode: 'USR',
    date: '2026-08-23T10:00:00.000Z',
    status: 'Em Andamento',
    approvalStatus: 'Pendente',
    macros: [],
    micros: [],
    factors: {},
    summary: {},
    calculations: [
      {
        id: 'calc-1',
        formula: 'Produtos Livres',
        modo_calculo: 'produtos_livres',
        selected: true,
        produtos_livres: [{ productId: 'product-1', quantity: 250 }],
        macros: [{ id: 'product-1', quantity: 250, price: 1200 }],
        micros: [],
      },
    ],
  } as unknown as Omit<PricingRecord, 'id'>;

  it('cria a precificação com cálculos normalizados e tenant atribuído pelo servidor', async () => {
    const returnedRow = {
      id: 'pricing-1',
      organization_id: 'organization-1',
      user_id: 'user-1',
      user_name: 'Usuário',
      user_code: 'USR',
      date: record.date,
      status: 'Em Andamento',
      approval_status: 'Pendente',
      macros: [],
      micros: [],
      factors: {},
      summary: {},
      calculations: [],
    };
    const single = vi.fn().mockResolvedValue({ data: returnedRow, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    fromMock.mockReturnValue({ insert });

    const result = await createPricingRecord(record);

    expect(fromMock).toHaveBeenCalledWith('pricing_records');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        approval_status: 'Pendente',
        calculations: [
          expect.objectContaining({
            formula: 'Produtos Livres',
            summary: expect.objectContaining({ totalWeight: 250, baseCost: 300 }),
          }),
        ],
      })
    );
    expect(insert.mock.calls[0][0]).not.toHaveProperty('organization_id');
    expect(result).toMatchObject({
      id: 'pricing-1',
      organizationId: 'organization-1',
      userId: 'user-1',
      approvalStatus: 'Pendente',
    });
  });

  it('mapeia os campos retornados pela consulta sem perder a organização', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'pricing-1',
          organization_id: 'organization-1',
          cod: 42,
          user_id: 'user-1',
          status: 'Fechada',
          approval_status: 'Aprovada',
        },
      ],
      error: null,
    });
    const select = vi.fn().mockReturnValue({ order });
    fromMock.mockReturnValue({ select });

    const result = await getPricingRecords();

    expect(result[0]).toMatchObject({
      id: 'pricing-1',
      organizationId: 'organization-1',
      cod: 42,
      formattedCod: '42',
      approvalStatus: 'Aprovada',
    });
  });

  it('atualiza campos permitidos sem aceitar troca de organização pelo cliente', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ update });

    await updatePricingRecord('pricing-1', {
      organizationId: 'outra-organizacao',
      status: 'Fechada',
      approvalStatus: 'Aprovada',
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Fechada',
        approval_status: 'Aprovada',
        updated_at: expect.any(String),
      })
    );
    expect(update.mock.calls[0][0]).not.toHaveProperty('organization_id');
    expect(eq).toHaveBeenCalledWith('id', 'pricing-1');
  });
});
