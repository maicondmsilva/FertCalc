import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NotificationCard } from '../NotificationCard';
import type { Notification } from '../../../types/notification.types';

const base: Notification = {
  id: 'n1',
  user_id: 'u1',
  type: 'pricing_approval',
  group_type: 'SYSTEM',
  title: 'Nova Precificação Pendente',
  message: 'Maria gerou uma precificação.',
  is_read: false,
  created_at: new Date().toISOString(),
};

describe('NotificationCard', () => {
  it('clicar marca como lido, fecha o card e abre a página do aviso', () => {
    const onClose = vi.fn();
    const onOpen = vi.fn();
    const pushState = vi.spyOn(window.history, 'pushState');
    render(
      <NotificationCard notification={base} onClose={onClose} onOpen={onOpen} autoClose={false} />
    );
    expect(screen.getByText('Visualizar')).toBeTruthy();
    fireEvent.click(screen.getByText('Nova Precificação Pendente'));
    expect(onOpen).toHaveBeenCalledWith(base);
    expect(onClose).toHaveBeenCalledWith('n1');
    expect(pushState).toHaveBeenCalledWith({}, '', '/approvals');
    pushState.mockRestore();
  });

  it('carregamento antigo vai para a Visão Geral', () => {
    const pushState = vi.spyOn(window.history, 'pushState');
    render(
      <NotificationCard
        notification={{
          ...base,
          type: 'NOVO_CARREGAMENTO',
          group_type: 'CARREGAMENTO',
          action_url: '/carregamento',
        }}
        onClose={vi.fn()}
        autoClose={false}
      />
    );
    fireEvent.click(screen.getByText('Nova Precificação Pendente'));
    expect(pushState).toHaveBeenCalledWith({}, '', '/carregamento_visao_geral');
    pushState.mockRestore();
  });
});
