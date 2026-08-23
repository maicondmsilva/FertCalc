import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../../types';
import AppContent, { type ActiveModule } from '../AppContent';

vi.mock('../../services/supabase', () => ({ supabase: {} }));
vi.mock('../Home', () => ({
  default: () => <div>Página inicial</div>,
}));
vi.mock('../Dashboard', () => ({
  default: () => <div>Dashboard de precificação</div>,
}));
vi.mock('../Calculator', () => ({
  default: ({ isSimplified }: { isSimplified: boolean }) => (
    <div>{isSimplified ? 'Calculadora simplificada' : 'Calculadora completa'}</div>
  ),
}));
vi.mock('../Carregamento', () => ({
  default: ({ view }: { view: string }) => <div>Carregamento: {view}</div>,
}));

const currentUser = {
  id: 'user-1',
  idNumeric: 1,
  email: 'user@example.com',
  name: 'Usuário',
  nickname: 'usuario',
  ativo: true,
  role: 'user',
} as User;

const renderContent = (
  activeModule: ActiveModule,
  activeTab: string,
  permissions: string[] = []
) =>
  render(
    <AppContent
      activeModule={activeModule}
      activeTab={activeTab}
      currentUser={currentUser}
      editingPricing={null}
      initialFormulaContext={{ formula: null, branchId: '', priceListId: '' }}
      hasPermission={(permission) => permissions.includes(permission)}
      onSelectModule={vi.fn()}
      onEditPricing={vi.fn()}
      onCalculatorSaved={vi.fn()}
      onClearCalculator={vi.fn()}
      onSendFormulaToCalculator={vi.fn()}
    />
  );

afterEach(cleanup);

describe('AppContent', () => {
  it('renderiza a página inicial quando nenhum módulo está ativo', () => {
    renderContent(null, '');
    expect(screen.getByText('Página inicial')).toBeDefined();
  });

  it('respeita a permissão da rota do dashboard', () => {
    const { container } = renderContent('pricing', 'dashboard');
    expect(container.firstChild).toBeNull();

    cleanup();
    renderContent('pricing', 'dashboard', ['dashboard']);
    expect(screen.getByText('Dashboard de precificação')).toBeDefined();
  });

  it('distingue as duas apresentações da calculadora', () => {
    renderContent('pricing', 'simplified_calculator', ['calculator']);
    expect(screen.getByText('Calculadora simplificada')).toBeDefined();
  });

  it('mapeia a rota logística para a visualização correta', () => {
    renderContent('carregamento', 'carregamento_logistica', ['carregamento']);
    expect(screen.getByText('Carregamento: logistica')).toBeDefined();
  });
});
