import { describe, expect, it } from 'vitest';
import { PricingRecord } from '../types';
import {
  filterPricingRecords,
  getPricingReportPeriodLabel,
  PricingReportFilterValues,
} from './pricingReportFilters';

const filters: PricingReportFilterValues = {
  search: '',
  status: '',
  approval: '',
  branchId: '',
  userId: '',
  month: '',
  startDate: '',
  endDate: '',
};

const pricing = {
  id: 'p1',
  cod: 12,
  formattedCod: 'PREC-0012',
  userId: 'u1',
  userName: 'Maria',
  date: '2026-08-15T12:00:00-03:00',
  status: 'Fechada',
  approvalStatus: 'Aprovada',
  factors: {
    branchId: 'b1',
    client: { name: 'Fazenda Horizonte', stateRegistration: '12345' },
    agent: { name: 'Agente Sul' },
  },
  calculations: [{ formula: '10-20-20' }],
} as PricingRecord;

describe('pricing report filters', () => {
  it('pesquisa por cliente, IE, código e fórmula', () => {
    for (const search of ['horizonte', '12345', 'PREC-0012', '10-20-20']) {
      expect(filterPricingRecords([pricing], { ...filters, search })).toHaveLength(1);
    }
  });

  it('filtra pelo mês local da precificação', () => {
    expect(filterPricingRecords([pricing], { ...filters, month: '2026-08' })).toHaveLength(1);
    expect(filterPricingRecords([pricing], { ...filters, month: '2026-09' })).toHaveLength(0);
  });

  it('combina filial, vendedor e período', () => {
    expect(
      filterPricingRecords([pricing], {
        ...filters,
        branchId: 'b1',
        userId: 'u1',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      })
    ).toHaveLength(1);
    expect(filterPricingRecords([pricing], { ...filters, branchId: 'b2' })).toHaveLength(0);
  });

  it('descreve o mês selecionado no relatório', () => {
    expect(getPricingReportPeriodLabel({ ...filters, month: '2026-08' })).toBe('agosto de 2026');
  });
});
