import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../../types';
import AppShell from '../AppShell';

const currentUser = {
  id: 'user-1',
  idNumeric: 1,
  email: 'user@example.com',
  name: 'Usuário',
  nickname: 'usuario',
  ativo: true,
  role: 'user',
} as User;

const renderShell = (overrides: { standalone?: boolean; onMarkAllRead?: () => void } = {}) =>
  render(
    <MemoryRouter>
      <AppShell
        activeModule="pricing"
        activeTab="dashboard"
        appSettings={{ companyName: 'FertCalc Pro', companyLogo: '' }}
        currentUser={currentUser}
        isStandalone={overrides.standalone ?? false}
        navItems={[]}
        hasPermission={() => true}
        notifications={[]}
        unreadCount={2}
        activeToasts={[]}
        canInstall={false}
        onClearNotifications={vi.fn()}
        onInstall={vi.fn()}
        onLogout={vi.fn()}
        onMarkAllNotificationsRead={overrides.onMarkAllRead ?? vi.fn()}
        onMarkNotificationRead={vi.fn()}
        onNavigate={vi.fn()}
        onOpenNotificationSettings={vi.fn()}
        onRemoveToast={vi.fn()}
      >
        <div>Conteúdo da rota</div>
      </AppShell>
    </MemoryRouter>
  );

afterEach(cleanup);

describe('AppShell', () => {
  it('renderiza a área principal dentro da estrutura autenticada', () => {
    renderShell();
    expect(screen.getByText('Conteúdo da rota')).toBeDefined();
    expect(screen.getByText('FertCalc Pro')).toBeDefined();
  });

  it('alterna o estado visual do menu lateral pelo cabeçalho', () => {
    renderShell();
    const collapseButton = screen.getByLabelText('Recolher menu lateral');
    fireEvent.click(collapseButton);
    expect(screen.getByLabelText('Expandir menu lateral')).toBeDefined();
  });

  it('marca as notificações como lidas ao abrir o painel', () => {
    const onMarkAllRead = vi.fn();
    renderShell({ onMarkAllRead });
    fireEvent.click(screen.getByText('2'));
    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Notificações')).toBeDefined();
  });

  it('oculta o cabeçalho no modo standalone sem ocultar o conteúdo', () => {
    renderShell({ standalone: true });
    expect(screen.queryByLabelText('Recolher menu lateral')).toBeNull();
    expect(screen.getByText('Conteúdo da rota')).toBeDefined();
  });
});
