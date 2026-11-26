import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getGoals: vi.fn(),
  getTransportadoras: vi.fn(),
}));
vi.mock('../../services/db', () => ({
  getGoals: mocks.getGoals,
  createGoal: vi.fn(),
  updateGoal: vi.fn(),
  deleteGoal: vi.fn(),
  getPricingRecords: vi.fn().mockResolvedValue([]),
  getUsers: vi.fn().mockResolvedValue([]),
  createNotification: vi.fn(),
  getManagersOfUser: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../services/carregamentoService', () => ({
  getAllTransportadoras: mocks.getTransportadoras,
  createTransportadora: vi.fn(),
  updateTransportadora: vi.fn(),
}));
vi.mock('../Carregamento/TransportadoraAccessManager', () => ({ default: () => null }));
const toast = { showSuccess: vi.fn(), showError: vi.fn() };
vi.mock('../Toast', () => ({ useToast: () => toast }));

import Goals from '../Goals';
import { TransportadoraManager } from '../Carregamento/TransportadoraManager';

const goal = (over: Record<string, unknown>) => ({
  id: 'g',
  userId: 'seller',
  userName: 'Vendedor',
  type: 'monthly',
  targetValue: 100,
  month: 11,
  year: 2026,
  status: 'Pendente',
  ...over,
});
const seller = { id: 'seller', name: 'Vendedor', role: 'user', permissions: {} } as never;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getTransportadoras.mockResolvedValue([{ id: 't1', nome: 'Translog', ativo: true }]);
});

describe('Metas: permissões', () => {
  it('vendedor exclui só a própria meta pendente e não aprova', async () => {
    mocks.getGoals.mockResolvedValue([goal({ id: 'p' }), goal({ id: 'a', status: 'Aprovada' })]);
    render(<Goals currentUser={seller} />);
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Excluir meta' })).toHaveLength(1)
    );
    expect(screen.queryByTitle('Aprovar')).toBeNull();
  });

  it('gerente com goals_edit aprova metas dos vendedores', async () => {
    mocks.getGoals.mockResolvedValue([goal({ id: 'p' })]);
    const manager = {
      id: 'mgr',
      name: 'Gerente',
      role: 'manager',
      managedUserIds: ['seller'],
      permissions: { goals_edit: true },
    } as never;
    render(<Goals currentUser={manager} />);
    await waitFor(() => expect(screen.getByTitle('Aprovar')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Excluir meta' })).toBeNull();
  });
});

describe('Transportadoras: permissões', () => {
  it('sem permissão é somente leitura', async () => {
    render(<TransportadoraManager currentUser={seller} />);
    await waitFor(() => expect(screen.getByText('Translog')).toBeTruthy());
    expect(screen.queryByText('Nova Transportadora')).toBeNull();
    expect(screen.getByText('Somente leitura')).toBeTruthy();
  });

  it('com criar e editar mostra as ações', async () => {
    const user = {
      id: 'x',
      role: 'user',
      permissions: { transportadoras_create: true, transportadoras_edit: true },
    } as never;
    render(<TransportadoraManager currentUser={user} />);
    await waitFor(() => expect(screen.getByText('Translog')).toBeTruthy());
    expect(screen.getByText('Nova Transportadora')).toBeTruthy();
    expect(screen.getByText('Desativar')).toBeTruthy();
  });
});
