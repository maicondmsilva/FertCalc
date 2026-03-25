import { useEffect, useCallback } from 'react';
import { useNotificationStore } from '../store/notificationStore';
import { subscribeToNotifications } from '../services/notificationSubscription';
import { useNotificationPreferences } from './useNotificationPreferences';
import { useNotificationSound } from './useNotificationSound';
import { getNotifications, markNotificationAsRead, deleteAllNotifications } from '../services/notificationService';

export function useNotifications(userId: string) {
  const store = useNotificationStore();
  const { preferences, isLoading: prefsLoading } = useNotificationPreferences(userId);
  const { playSound } = useNotificationSound();

  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    
    try {
      const data = await getNotifications(userId, 20);
      store.setNotifications(data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }, [userId, store]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!userId || prefsLoading) return;

    const unsubscribe = subscribeToNotifications(userId, (notification) => {
      // Check if user has completely disabled in-app notifications
      const inAppEnabled = preferences?.in_app_enabled ?? true;
      if (!inAppEnabled) return;

      // Check if this specific group/type is disabled
      if (preferences?.disabled_types?.includes(notification.group_type) || 
          preferences?.disabled_types?.includes(notification.type)) {
        return;
      }

      store.addNotification(notification);

      // Play sound
      const soundEnabled = preferences?.sound_enabled ?? true;
      if (soundEnabled) {
        playSound(notification.group_type);
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, [userId, preferences, prefsLoading, store, playSound]);

  // Optionally extend markAsRead to also update Supabase
  const markAsReadDb = async (id: string) => {
    try {
      store.markAsRead(id);
      if (!userId) return;
      await markNotificationAsRead(id, userId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const clearAllDb = async () => {
    try {
      store.clearAll();
      if (!userId) return;
      await deleteAllNotifications(userId);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  return {
    notifications: store.notifications,
    unreadCount: store.unreadCount,
    activeToasts: store.activeToasts,
    addNotification: store.addNotification,
    removeToast: store.removeToast,
    markAsRead: markAsReadDb,
    clearAll: clearAllDb
  };
}
