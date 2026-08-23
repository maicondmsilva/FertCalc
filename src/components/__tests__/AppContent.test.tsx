import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PricingRecord, User } from '../../types';
import type { ActiveModule } from '../../navigation/appNavigation';
import AppContent from '../AppContent';

vi.mock('../../services/supabase', () => ({ supabase: {} }));
vi.mock('../Home', () => ({
  default: () => <div>Página inicial</div>,
}));
vi.mock('../Dashboard', () => ({
  default: () => <div>Dashboard de precificação</div>,
}));
vi.mock('../Calculator', () => ({
  default: ({
    isSimplified,
    initialData,
    onSaveSuccess,
  }: {
    isSimplified: boolean;
    initialData?: PricingRecord | null;
    onSaveSuccess?: (record: PricingRecord) => void;
  }) => (
    <div>
      {isSimplified ? 'Calculadora simplificada' : 'Calculadora completa'}
      {initialData && <span>Precificação em edição: {initialData.id}</span>}
      <button onClick={() => onSaveSuccess?.({ id: 'pricing-1' } as PricingRecord)}>
        Salvar precificação
      </button>
    </div>
  ),
}));
vi.mock('../History', () => ({
  default: ({ onEdit }: { onEdit: (record: PricingRecord) => void }) => (
    <button onClick={() => onEdit({ id: 'pricing-1' } as PricingRecord)}>
      Editar precificação pricing-1
    </button>
  ),
}));
vi.mock('../Approvals', () => ({
  default: () => <div>Aprovações de precificação</div>,
}));
vi.mock('../PricingReport', () => ({
  default: () => <div>Relatório de precificação</div>,
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

const renderContent = (activeModule: ActiveModule, activeTab: string, permissions: string[] = []) =>
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

  it('distingue as duas apresentações da calculadora', async () => {
    renderContent('pricing', 'simplified_calculator', ['calculator']);
    expect(await screen.findByText('Calculadora simplificada')).toBeDefined();
  });

  it('mapeia a rota logística para a visualização correta', async () => {
    renderContent('carregamento', 'carregamento_logistica', ['carregamento']);
    expect(await screen.findByText('Carregamento: logistica')).toBeDefined();
  });

  it('preserva o contrato da jornada entre cálculo, histórico, aprovação e relatório', async () => {
    const onCalculatorSaved = vi.fn();
    const onEditPricing = vi.fn();
    const commonProps = {
      activeModule: 'pricing' as const,
      currentUser,
      editingPricing: null,
      initialFormulaContext: { formula: null, branchId: '', priceListId: '' },
      hasPermission: () => true,
      onSelectModule: vi.fn(),
      onEditPricing,
      onCalculatorSaved,
      onClearCalculator: vi.fn(),
      onSendFormulaToCalculator: vi.fn(),
    };

    const view = render(<AppContent {...commonProps} activeTab="calculator" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Salvar precificação' }));
    expect(onCalculatorSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'pricing-1' }));

    view.rerender(<AppContent {...commonProps} activeTab="history" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar precificação pricing-1' }));
    expect(onEditPricing).toHaveBeenCalledWith(expect.objectContaining({ id: 'pricing-1' }));

    view.rerender(
      <AppContent
        {...commonProps}
        activeTab="calculator"
        editingPricing={{ id: 'pricing-1' } as PricingRecord}
      />
    );
    expect(await screen.findByText('Precificação em edição: pricing-1')).toBeInTheDocument();

    view.rerender(<AppContent {...commonProps} activeTab="approvals" />);
    expect(await screen.findByText('Aprovações de precificação')).toBeInTheDocument();

    view.rerender(<AppContent {...commonProps} activeTab="pricingReport" />);
    expect(await screen.findByText('Relatório de precificação')).toBeInTheDocument();
  });
});
