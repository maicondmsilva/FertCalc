import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../types';
import { useAppData } from '../hooks/useAppData';
import { useNotifications } from '../hooks/useNotifications';
import AuthenticatedApp from './AuthenticatedApp';

vi.mock('../components/AppShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock('../components/AppContent', () => ({
  default: ({ activeTab, currentUser }: { activeTab: string; currentUser: User }) => (
    <div>
      {activeTab}: {currentUser.id}
    </div>
  ),
}));
vi.mock('../hooks/useNotifications', () => ({ useNotifications: vi.fn() }));
vi.mock('../hooks/useAppData', () => ({ useAppData: vi.fn() }));
vi.mock('../hooks/usePWAInstall', () => ({
  usePWAInstall: () => ({ canInstall: false, handleInstall: vi.fn() }),
}));
vi.mock('../hooks/usePricingWorkspace', () => ({
  usePricingWorkspace: () => ({
    editingPricing: null,
    initialFormulaContext: { formula: null, branchId: '', priceListId: '' },
    navigateFromShell: vi.fn(),
    selectModule: vi.fn(),
    editPricing: vi.fn(),
    calculatorSaved: vi.fn(),
    clearCalculator: vi.fn(),
    sendFormulaToCalculator: vi.fn(),
  }),
}));

const currentUser = {
  id: 'user-1',
  idNumeric: 1,
  email: 'user@example.com',
  name: 'Usuário',
  nickname: 'usuario',
  ativo: true,
  role: 'admin',
} as User;

afterEach(cleanup);

describe('AuthenticatedApp', () => {
  it('inicializa os dados privados somente com o usuário autenticado', () => {
    vi.mocked(useNotifications).mockReturnValue({
      notifications: [],
      unreadCount: 0,
      activeToasts: [],
      addNotification: vi.fn(),
      removeToast: vi.fn(),
      markAsRead: vi.fn(),
      markAllRead: vi.fn(),
      clearAll: vi.fn(),
    });
    vi.mocked(useAppData).mockReturnValue({
      appSettings: { companyName: 'FertCalc Pro', companyLogo: '' },
      pendingExpenseCount: 0,
      checkedExpenseCount: 0,
    });

    render(
      <MemoryRouter>
        <AuthenticatedApp
          activeModule="pricing"
          activeTab="dashboard"
          currentUser={currentUser}
          isStandalone={false}
          onLogout={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(useNotifications).toHaveBeenCalledWith('user-1');
    expect(useAppData).toHaveBeenCalledWith('pricing', 'user-1');
    expect(screen.getByText('dashboard: user-1')).toBeInTheDocument();
  });
});
