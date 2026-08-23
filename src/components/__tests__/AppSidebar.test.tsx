import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Circle } from 'lucide-react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NavItem, User } from '../../types';
import AppSidebar from '../AppSidebar';

const currentUser = {
  id: 'user-1',
  idNumeric: 1,
  email: 'user@example.com',
  name: 'Usuário Teste',
  nickname: 'usuario',
  ativo: true,
  role: 'user',
} as User;

const navItems: NavItem[] = [
  { id: 'calculator', label: 'Calculadora', icon: Circle, permission: 'calculator' },
  {
    id: 'expenses_workflow_group',
    label: 'Workflow',
    icon: Circle,
    permission: 'expenses',
    type: 'parent',
    children: [
      {
        id: 'expenses_conferencia',
        label: 'Conferência',
        icon: Circle,
        permission: 'expenses',
        badge: 3,
      },
    ],
  },
];

const renderSidebar = (onNavigate = vi.fn()) => {
  render(
    <MemoryRouter>
      <AppSidebar
        activeModule="pricing"
        activeTab="calculator"
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
  it('exibe empresa, usuário e itens do módulo', () => {
    renderSidebar();
    expect(screen.getByText('FertCalc Pro')).toBeDefined();
    expect(screen.getByText('Usuário Teste')).toBeDefined();
    expect(screen.getByText('Calculadora')).toBeDefined();
  });

  it('preserva o contexto ao navegar entre as calculadoras', () => {
    const onNavigate = renderSidebar();
    fireEvent.click(screen.getByText('Calculadora'));
    expect(onNavigate).toHaveBeenCalledWith('calculator', false);
  });

  it('abre grupos, mostra badges e limpa o contexto ao navegar para um filho', () => {
    const onNavigate = renderSidebar();
    fireEvent.click(screen.getByText('Workflow'));
    expect(screen.getByText('3')).toBeDefined();
    fireEvent.click(screen.getByText('Conferência'));
    expect(onNavigate).toHaveBeenCalledWith('expenses_conferencia', true);
  });

  it('mantém o comportamento nativo de abrir link em outra aba', () => {
    const onNavigate = renderSidebar();
    const link = screen.getByText('Calculadora').closest('a')!;
    link.addEventListener('click', (event) => event.preventDefault(), { capture: true });
    fireEvent.click(link, { ctrlKey: true });
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
