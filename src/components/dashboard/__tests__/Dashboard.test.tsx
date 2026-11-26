import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { screen, fireEvent, within } from '@testing-library/dom';
import type { DashboardData } from '../useDashboardData';

const state: { current: DashboardData } = {
  current: {
    pricings: [],
    goals: [],
    branches: [],
    loading: false,
    error: null,
    reload: vi.fn(),
  },
};
// O gráfico (Recharts) usa ResizeObserver, que o jsdom não tem.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
);

vi.mock('../useDashboardData', () => ({ useDashboardData: () => state.current }));

import Dashboard from '../../Dashboard';
import { toPeriodKey } from '../../../utils/pricingDashboard';

const today = new Date();
const isoDay = `${toPeriodKey(today)}-05`;
const manager = { id: 'm1', name: 'Gestor', role: 'manager', permissions: {} } as never;
const seller = { id: 'u1', name: 'Ana', role: 'user', permissions: {} } as never;

const pricing = (overrides: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  cod: 12,
  formattedCod: '0012',
  userId: 'm1',
  userName: 'Gestor',
  date: isoDay,
  status: 'Fechada',
  approvalStatus: 'Aprovada',
  macros: [],
  micros: [],
  factors: { totalTons: 10, client: { name: 'Fazenda Boa Vista' } },
  summary: { totalSaleValue: 20000 },
  ...overrides,
});

beforeEach(() => {
  state.current = {
    pricings: [],
    goals: [],
    branches: [],
    loading: false,
    error: null,
    reload: vi.fn(),
  };
});

describe('Dashboard', () => {
  it('mostra o esqueleto enquanto carrega (sem zeros falsos)', () => {
    state.current = { ...state.current, loading: true };
    render(<Dashboard currentUser={manager} />);
    expect(screen.getByLabelText('Carregando painel')).toBeTruthy();
    expect(screen.queryByText('Vendas fechadas')).toBeNull();
  });

  it('erro de carga mostra aviso e tentar de novo', () => {
    const reload = vi.fn();
    state.current = { ...state.current, error: 'Falhou', reload };
    render(<Dashboard currentUser={manager} />);
    expect(screen.getByRole('alert').textContent).toContain('Falhou');
    fireEvent.click(screen.getByRole('button', { name: /Tentar de novo/ }));
    expect(reload).toHaveBeenCalled();
    expect(screen.queryByText('Vendas fechadas')).toBeNull();
  });

  it('com dados: indicadores, meta própria, atividades e ranking de vendedores para gestor', () => {
    state.current = {
      ...state.current,
      pricings: [pricing(), pricing({ userId: 'u9', userName: 'Equipe' })] as never,
      goals: [
        {
          id: 'g',
          userId: 'm1',
          userName: 'Gestor',
          type: 'monthly',
          targetValue: 40,
          month: today.getMonth() + 1,
          year: today.getFullYear(),
          status: 'Aprovada',
        },
      ],
    };
    render(<Dashboard currentUser={manager} />);
    expect(screen.getByText('Vendas fechadas')).toBeTruthy();
    expect(screen.getByText(/R\$\s*40\.000,00/)).toBeTruthy();
    // Meta: só as 10 t do gestor contra 40 t (antes somava a equipe: 50%).
    expect(screen.getByText('25%')).toBeTruthy();
    expect(screen.getAllByText('Fazenda Boa Vista').length).toBeGreaterThan(0);
    expect(screen.getByRole('tab', { name: 'Vendedores' })).toBeTruthy();
  });

  it('vendedor não vê ranking de vendedores', () => {
    state.current = { ...state.current, pricings: [pricing({ userId: 'u1' })] as never };
    render(<Dashboard currentUser={seller} />);
    expect(screen.queryByRole('tab', { name: 'Vendedores' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Filiais' })).toBeTruthy();
  });

  it('ranking alterna entre valor e toneladas', () => {
    state.current = {
      ...state.current,
      pricings: [
        pricing({
          userId: 'a',
          userName: 'Valor Alto',
          factors: { totalTons: 5 },
          summary: { totalSaleValue: 90000 },
        }),
        pricing({
          userId: 'b',
          userName: 'Volume Alto',
          factors: { totalTons: 50 },
          summary: { totalSaleValue: 10000 },
        }),
      ] as never,
    };
    render(<Dashboard currentUser={manager} />);
    const first = () =>
      screen.getAllByRole('listitem').find((li) => /^1\./.test(li.textContent || ''));
    expect(first()?.textContent).toContain('Valor Alto');
    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Ordenar ranking por' })).getByRole('radio', {
        name: 't',
      })
    );
    expect(
      screen.getAllByRole('listitem').some((li) => /^1\.Volume Alto/.test(li.textContent || ''))
    ).toBe(true);
  });
});
