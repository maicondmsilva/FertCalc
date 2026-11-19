import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LayoutDashboard } from 'lucide-react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NavItem, User } from '../types';
import AppSidebar from './AppSidebar';

const currentUser = {
  id: 'user-1',
  idNumeric: 1,
  email: 'user@example.com',
  name: 'Usuário',
  nickname: 'usuario',
  ativo: true,
  role: 'user',
} as User;

const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    permission: 'dashboard',
  },
];

const renderSidebar = (activeModule: 'pricing' | 'config' = 'pricing') => {
  const onNavigate = vi.fn();
  render(
    <MemoryRouter>
      <AppSidebar
        activeModule={activeModule}
        activeTab="dashboard"
        appSettings={{ companyName: 'FertCalc Pro', companyLogo: '' }}
        currentUser={currentUser}
        isExpanded={true}
        isMobileOpen={false}
        isStandalone={false}
        navItems={navItems}
        hasPermission={() => true}
        onCloseMobile={vi.fn()}
        onLogout={vi.fn()}
        onNavigate={onNavigate}
      />
    </MemoryRouter>
  );
  return onNavigate;
};

afterEach(cleanup);

describe('AppSidebar', () => {
  it('mantém a navegação normal no item da precificação', () => {
    const onNavigate = renderSidebar();

    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));

    expect(onNavigate).toHaveBeenCalledWith('dashboard', true);
  });

  it('usa o endereço da página sozinha no link, para o botão direito abrir em nova guia', () => {
    renderSidebar();

    const link = screen.getByRole('link', { name: 'Dashboard' });
    expect(link.getAttribute('href')).toBe('/dashboard?standalone=true');
    expect(link.getAttribute('target')).toBeNull();
    expect(screen.queryByLabelText('Abrir Dashboard em nova guia')).toBeNull();
  });

  it('abre em nova guia com Ctrl+clique sem navegar na guia atual', () => {
    const onNavigate = renderSidebar();

    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }), { ctrlKey: true });

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('mantém o endereço normal fora do módulo de precificação', () => {
    renderSidebar('config');
    expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('href')).toBe('/dashboard');
  });
});
