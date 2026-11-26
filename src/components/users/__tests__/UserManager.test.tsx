import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getUsers: vi.fn(),
  getBranches: vi.fn(),
  getAccessProfiles: vi.fn(),
  listRegions: vi.fn(),
  listUserRegions: vi.fn(),
  setUserRegions: vi.fn(),
  adminUpdateAuthUser: vi.fn(),
  createAuthUser: vi.fn(),
  capabilities: vi.fn(),
}));

vi.mock('../../../services/db', () => ({
  getUsers: mocks.getUsers,
  getBranches: mocks.getBranches,
  deleteUser: vi.fn(),
}));
vi.mock('../../../services/accessProfileService', () => ({
  getAccessProfiles: mocks.getAccessProfiles,
}));
vi.mock('../../../services/regionService', () => ({
  listRegions: mocks.listRegions,
  listUserRegions: mocks.listUserRegions,
  setUserRegions: mocks.setUserRegions,
}));
vi.mock('../../../services/authService', () => ({
  adminUpdateAuthUser: mocks.adminUpdateAuthUser,
  createAuthUser: mocks.createAuthUser,
  adminDeleteAuthUser: vi.fn(),
  adminUpdateAuthPassword: vi.fn(),
}));
vi.mock('../../../services/hierarchyService', () => ({
  getUserManagementCapabilities: mocks.capabilities,
  canChangeUserRole: vi.fn().mockResolvedValue(true),
}));
vi.mock('../../../hooks/useAccessLevels', () => ({
  useAccessLevels: () => ({ levels: [], byCode: new Map() }),
}));
vi.mock('../../Toast', () => ({ useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn() }) }));

import UserManager from '../../UserManager';

const admin = {
  id: 'adm',
  name: 'Admin',
  email: 'a@x.com',
  role: 'admin',
  ativo: true,
  permissions: {},
} as never;
const ana = {
  id: 'ana',
  name: 'Ana Ribeiro',
  email: 'ana@x.com',
  nickname: 'ana',
  role: 'user',
  ativo: true,
  permissions: { calculator: true },
  managedUserIds: [],
  filiais_permitidas: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUsers.mockResolvedValue([ana]);
  mocks.getBranches.mockResolvedValue([]);
  mocks.getAccessProfiles.mockResolvedValue([]);
  mocks.listRegions.mockResolvedValue([
    { id: 'r1', name: 'Triângulo', ativo: true },
    { id: 'r2', name: 'Sul de Goiás', ativo: true },
  ]);
  mocks.listUserRegions.mockResolvedValue([]);
  mocks.capabilities.mockResolvedValue({ ana: { canManage: true, canDelete: true } });
  mocks.adminUpdateAuthUser.mockResolvedValue({ success: true });
  mocks.setUserRegions.mockResolvedValue(undefined);
});

describe('Usuários', () => {
  it('mostra indicador de sem região e salva regiões com a principal', async () => {
    render(<UserManager currentUser={admin} />);
    await waitFor(() => expect(screen.getAllByText('Ana Ribeiro').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Sem região').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: 'Editar Ana Ribeiro' })[0]);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('tab', { name: /Regiões/ }));
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Triângulo/ }));
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Sul de Goiás/ }));
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Tornar Sul de Goiás a região principal' })
    );
    expect(within(dialog).getByText(/Alterações não salvas: Regiões/)).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar usuário' }));
    await waitFor(() =>
      expect(mocks.setUserRegions).toHaveBeenCalledWith('ana', ['r1', 'r2'], 'r2')
    );
    expect(mocks.adminUpdateAuthUser).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'ana',
        permissions: expect.objectContaining({ calculator: true }),
      })
    );
  });

  it('não deixa salvar novo usuário com senha fraca e mostra a aba do problema', async () => {
    render(<UserManager currentUser={admin} />);
    await waitFor(() => expect(screen.getAllByText('Ana Ribeiro').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: /Novo usuário/ }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Nome/), { target: { value: 'Bruno' } });
    fireEvent.change(within(dialog).getByLabelText(/E-mail/), { target: { value: 'bruno@x.com' } });
    fireEvent.change(within(dialog).getByLabelText(/Apelido/), { target: { value: 'bruno' } });
    fireEvent.change(within(dialog).getByLabelText(/Senha inicial/), { target: { value: 'abc' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar usuário' }));
    expect(within(dialog).getByRole('alert').textContent).toMatch(/senha inicial/i);
    expect(mocks.createAuthUser).not.toHaveBeenCalled();
  });
});
