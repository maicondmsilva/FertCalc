import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import { buildRegionRows, regionProblem, regionStats } from '../regionModel';

const service = vi.hoisted(() => ({
  listRegions: vi.fn(),
  listUserRegions: vi.fn(),
  saveRegion: vi.fn(),
  deleteOrDeactivateRegion: vi.fn(),
  regionErrorMessage: vi.fn(() => 'erro'),
}));
const db = vi.hoisted(() => ({ getUsers: vi.fn() }));
vi.mock('../../../services/regionService', () => service);
vi.mock('../../../services/db', () => db);
vi.mock('../../Toast', () => ({ useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn() }) }));
vi.mock('../../../hooks/useModalBackNavigation', () => ({ useModalBackNavigation: () => {} }));

import RegionManager from '../RegionManager';

const regions = [
  { id: 'r1', name: 'Sul de Goiás', code: 'GO-SUL', ativo: true },
  { id: 'r2', name: 'Oeste da Bahia', code: 'BA-OES', ativo: false },
];
const users = [
  { id: 'u1', name: 'Ana Souza', email: 'ana@x.com', ativo: true },
  { id: 'u2', name: 'Bruno Lima', email: 'bruno@x.com', ativo: true },
  { id: 'u3', name: 'Carla Admin', email: 'carla@x.com', ativo: true },
];
const links = [
  { userId: 'u1', regionId: 'r1' },
  { userId: 'u2', regionId: 'r1' },
];

beforeEach(() => {
  Object.values(service).forEach((fn) => fn.mockReset());
  service.listRegions.mockResolvedValue(regions);
  service.listUserRegions.mockResolvedValue(links);
  service.saveRegion.mockResolvedValue(undefined);
  service.regionErrorMessage.mockReturnValue('erro');
  db.getUsers.mockResolvedValue(users);
});

describe('regionModel', () => {
  it('junta usuários, ordena ativas primeiro e calcula indicadores', () => {
    const rows = buildRegionRows(regions as never, links, users as never);
    expect(rows.map((row) => row.name)).toEqual(['Sul de Goiás', 'Oeste da Bahia']);
    expect(rows[0].users.map((user) => user.name)).toEqual(['Ana Souza', 'Bruno Lima']);
    expect(regionStats(rows, users as never)).toEqual({
      activeRegions: 1,
      usersWithRegion: 2,
      usersWithoutRegion: 1,
    });
  });

  it('valida nome e código repetidos (sem acento e sem caixa)', () => {
    const rows = buildRegionRows(regions as never, links, users as never);
    expect(regionProblem({ name: 'sul de goias', code: '' }, rows)).toMatch(/nome/);
    expect(regionProblem({ name: 'Nova', code: 'go-sul' }, rows)).toMatch(/código/);
    expect(regionProblem({ name: 'Sul de Goiás', code: 'GO-SUL' }, rows, 'r1')).toBeNull();
    expect(regionProblem({ name: 'x', code: '' }, rows)).toMatch(/Informe/);
  });
});

describe('RegionManager', () => {
  it('lista regiões com usuários e situação', async () => {
    render(<RegionManager />);
    expect(await screen.findByText('Sul de Goiás')).toBeTruthy();
    expect(screen.getByText('Ana Souza')).toBeTruthy();
    expect(screen.getByText('Inativa')).toBeTruthy();
  });

  it('cria região vinculando usuário', async () => {
    render(<RegionManager />);
    await screen.findByText('Sul de Goiás');
    fireEvent.click(screen.getByRole('button', { name: /Nova região/ }));
    fireEvent.change(screen.getByLabelText(/Nome/), { target: { value: 'Triângulo Mineiro' } });
    fireEvent.change(screen.getByLabelText('Código'), { target: { value: 'mg-tri' } });
    fireEvent.change(screen.getByLabelText('Adicionar usuário'), { target: { value: 'carla' } });
    fireEvent.click(screen.getByText('Carla Admin'));
    fireEvent.click(screen.getByRole('button', { name: /Salvar região/ }));
    await waitFor(() => expect(service.saveRegion).toHaveBeenCalledTimes(1));
    expect(service.saveRegion.mock.calls[0][0]).toMatchObject({
      name: 'Triângulo Mineiro',
      code: 'MG-TRI',
      ativo: true,
      userIds: ['u3'],
    });
    expect(service.saveRegion.mock.calls[0][1]).toEqual({ userIds: [] });
  });
});
