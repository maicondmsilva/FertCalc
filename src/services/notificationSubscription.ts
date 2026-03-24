import { supabase } from './supabase';
import { Notification } from '../types/notification.types';

export function subscribeToNotifications(userId: string, callback: (notification: Notification) => void) {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        // payload.new is the new inserted row
        callback(payload.new as Notification);
      }
    )
    .subscribe();
    
  return () => {
    supabase.removeChannel(channel);
  };
}
