import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getAccessProfiles: vi.fn(),
  updateAccessProfile: vi.fn(),
  getUsers: vi.fn(),
  updateUser: vi.fn(),
}));
vi.mock('../../../services/accessProfileService', () => ({
  getAccessProfiles: mocks.getAccessProfiles,
  updateAccessProfile: mocks.updateAccessProfile,
  createAccessProfile: vi.fn(),
  deleteAccessProfile: vi.fn(),
}));
vi.mock('../../../services/db', () => ({ getUsers: mocks.getUsers, updateUser: mocks.updateUser }));
vi.mock('../../Toast', () => ({ useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn() }) }));

import AccessProfileManager, { profileErrorMessage } from '../../AccessProfileManager';

const profile = {
  id: 'p1',
  name: 'Vendedor padrão',
  permissions: { calculator: true },
  created_at: '',
  updated_at: '',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAccessProfiles.mockResolvedValue([profile]);
  mocks.getUsers.mockResolvedValue([
    { id: 'u1', name: 'Igual', accessProfileId: 'p1', permissions: { calculator: true } },
    {
      id: 'u2',
      name: 'Ajustado',
      accessProfileId: 'p1',
      permissions: { calculator: true, goals: true },
    },
  ]);
  mocks.updateAccessProfile.mockResolvedValue({
    ...profile,
    permissions: { calculator: true, dashboard: true },
  });
  mocks.updateUser.mockResolvedValue(undefined);
});

describe('Perfis de acesso', () => {
  it('ao salvar, oferece atualizar só quem usa o perfil sem ajustes', async () => {
    render(<AccessProfileManager currentUser={{ role: 'admin' } as never} />);
    await waitFor(() => expect(screen.getAllByText('Vendedor padrão').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('switch', { name: /Dashboard/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar perfil' }));
    await waitFor(() => expect(screen.getByText(/1 usuário\(s\) usam/)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar usuários' }));
    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledTimes(1));
    expect(mocks.updateUser).toHaveBeenCalledWith('u1', {
      permissions: expect.objectContaining({ calculator: true, dashboard: true }),
    });
  });

  it('somente leitura para quem não é admin', async () => {
    render(<AccessProfileManager currentUser={{ role: 'manager' } as never} />);
    await waitFor(() => expect(screen.getByText(/Somente leitura/)).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Salvar perfil' })).toBeNull();
  });

  it('traduz erros do banco', () => {
    expect(profileErrorMessage(new Error('duplicate key access_profiles_org_name_key'))).toMatch(
      /Já existe/
    );
    expect(profileErrorMessage(new Error('new row violates row-level security'))).toMatch(
      /administradores/
    );
  });
});
