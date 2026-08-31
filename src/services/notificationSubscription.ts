import { supabase } from './supabase';
import { Notification } from '../types/notification.types';

export type NotificationSubscriptionStatus =
  | 'SUBSCRIBED'
  | 'TIMED_OUT'
  | 'CLOSED'
  | 'CHANNEL_ERROR';

export function subscribeToNotifications(
  userId: string,
  callback: (notification: Notification) => void,
  onStatus?: (status: NotificationSubscriptionStatus) => void
) {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        callback(payload.new as Notification);
      }
    )
    .subscribe((status) => {
      onStatus?.(status as NotificationSubscriptionStatus);
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error(`Falha na assinatura de notificacoes (${status}).`);
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}
