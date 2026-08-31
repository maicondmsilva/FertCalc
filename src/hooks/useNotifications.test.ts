import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getNotifications } from '../services/notificationService';
import { subscribeToNotifications } from '../services/notificationSubscription';
import { useNotificationStore } from '../store/notificationStore';
import type { Notification } from '../types/notification.types';
import { useNotifications } from './useNotifications';

const { playSound, preferencesResult } = vi.hoisted(() => ({
  playSound: vi.fn(),
  preferencesResult: { preferences: null, isLoading: false },
}));

vi.mock('../services/notificationService', () => ({
  getNotifications: vi.fn(),
  markNotificationAsRead: vi.fn(),
  markAllNotificationsAsRead: vi.fn(),
  deleteAllNotifications: vi.fn(),
}));
vi.mock('../services/notificationSubscription', () => ({
  subscribeToNotifications: vi.fn(),
}));
vi.mock('./useNotificationPreferences', () => ({
  useNotificationPreferences: () => preferencesResult,
}));
vi.mock('./useNotificationSound', () => ({
  useNotificationSound: () => ({ playSound }),
}));

const notification = (id: string): Notification =>
  ({
    id,
    user_id: 'user-1',
    title: 'Atualização',
    message: 'Nova notificação',
    type: 'pricing_created',
    group_type: 'pricing',
    is_read: false,
    created_at: '2026-08-23T10:00:00.000Z',
  }) as Notification;

beforeEach(() => {
  useNotificationStore.setState({ notifications: [], unreadCount: 0, activeToasts: [] });
  vi.mocked(getNotifications).mockReset().mockResolvedValue([]);
  vi.mocked(subscribeToNotifications).mockReset().mockReturnValue(vi.fn());
});

afterEach(cleanup);

describe('useNotifications', () => {
  it('não recarrega nem refaz a assinatura quando o store recebe uma notificação', async () => {
    const { result } = renderHook(() => useNotifications('user-1'));

    await waitFor(() => expect(getNotifications).toHaveBeenCalledTimes(1));
    expect(subscribeToNotifications).toHaveBeenCalledTimes(1);

    act(() => useNotificationStore.getState().addNotification(notification('notification-1')));

    expect(result.current.notifications).toHaveLength(1);
    expect(getNotifications).toHaveBeenCalledTimes(1);
    expect(subscribeToNotifications).toHaveBeenCalledTimes(1);
  });

  it('reconcilia notificacoes quando a assinatura conecta', async () => {
    vi.mocked(subscribeToNotifications).mockImplementation((_userId, _callback, onStatus) => {
      onStatus?.('SUBSCRIBED');
      return vi.fn();
    });

    renderHook(() => useNotifications('user-1'));

    await waitFor(() => expect(getNotifications).toHaveBeenCalledTimes(2));
  });

  it('nao duplica notificacao recebida novamente apos reconexao', () => {
    const item = notification('notification-1');

    act(() => {
      useNotificationStore.getState().addNotification(item);
      useNotificationStore.getState().addNotification(item);
    });

    const state = useNotificationStore.getState();
    expect(state.notifications).toHaveLength(1);
    expect(state.activeToasts).toHaveLength(1);
    expect(state.unreadCount).toBe(1);
  });

  it('nao cria toast nem incrementa contador para notificacao ja lida', () => {
    act(() =>
      useNotificationStore
        .getState()
        .addNotification({ ...notification('notification-read'), is_read: true })
    );

    const state = useNotificationStore.getState();
    expect(state.notifications).toHaveLength(1);
    expect(state.activeToasts).toHaveLength(0);
    expect(state.unreadCount).toBe(0);
  });
});
