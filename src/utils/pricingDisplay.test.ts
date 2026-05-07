import { describe, expect, it } from 'vitest';
import {
  formatDatePtBr,
  formatPricingTransport,
  getPedidoVendaDueDate,
  getPricingDueDate,
  getPricingFreightType,
  getPricingFreightValue,
} from './pricingDisplay';

describe('pricingDisplay', () => {
  it('lê vencimento salvo em dueDate', () => {
    expect(getPricingDueDate({ factors: { dueDate: '2026-05-30' } } as any)).toBe('2026-05-30');
  });

  it('aceita campos legados de vencimento', () => {
    expect(getPricingDueDate({ factors: { data_vencimento: '2026-06-01' } } as any)).toBe(
      '2026-06-01'
    );
    expect(getPricingDueDate({ factors: { data_validade: '2026-06-02' } } as any)).toBe(
      '2026-06-02'
    );
    expect(getPricingDueDate({ vencimento: '2026-06-03' } as any)).toBe('2026-06-03');
  });

  it('prioriza tipo de frete salvo na precificação', () => {
    expect(
      getPricingFreightType({ factors: { tipoFrete: 'FOB' }, summary: { freightValue: 80 } } as any)
    ).toBe('FOB');
    expect(getPricingFreightValue({ factors: { tipo_frete: 'CIF', freight: 75 } } as any)).toBe(75);
  });

  it('formata transporte CIF e FOB corretamente', () => {
    expect(formatPricingTransport({ factors: { tipoFrete: 'FOB', freight: 90 } } as any)).toBe(
      'FOB'
    );
    expect(formatPricingTransport({ factors: { tipoFrete: 'CIF', freight: 125.5 } } as any)).toBe(
      'CIF — R$ 125,50/t'
    );
  });

  it('formata datas para pt-BR', () => {
    expect(formatDatePtBr('2026-05-07')).toBe('07/05/2026');
    expect(formatDatePtBr('')).toBe('—');
  });

  it('usa data_vencimento do pedido quando disponível', () => {
    expect(
      getPedidoVendaDueDate({ data_vencimento: '2026-06-10', data_pedido: '2026-06-01' } as any)
    ).toBe('2026-06-10');
    expect(getPedidoVendaDueDate({ data_pedido: '2026-06-01' } as any)).toBe('2026-06-01');
  });
});
