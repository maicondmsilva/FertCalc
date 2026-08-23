import { useEffect, useCallback } from 'react';
import { useNotificationStore } from '../store/notificationStore';
import { subscribeToNotifications } from '../services/notificationSubscription';
import { useNotificationPreferences } from './useNotificationPreferences';
import { useNotificationSound } from './useNotificationSound';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteAllNotifications,
} from '../services/notificationService';

export function useNotifications(userId: string) {
  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const activeToasts = useNotificationStore((state) => state.activeToasts);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const removeToast = useNotificationStore((state) => state.removeToast);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const clearAll = useNotificationStore((state) => state.clearAll);
  const setNotifications = useNotificationStore((state) => state.setNotifications);
  const { preferences, isLoading: prefsLoading } = useNotificationPreferences(userId);
  const { playSound } = useNotificationSound();

  const loadNotifications = useCallback(async () => {
    if (!userId) return;

    try {
      const data = await getNotifications(userId, 20);
      setNotifications(data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }, [setNotifications, userId]);

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
      if (
        preferences?.disabled_types?.includes(notification.group_type) ||
        preferences?.disabled_types?.includes(notification.type)
      ) {
        return;
      }

      addNotification(notification);

      // Play sound
      const soundEnabled = preferences?.sound_enabled ?? true;
      if (soundEnabled) {
        playSound(notification.group_type);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [addNotification, playSound, preferences, prefsLoading, userId]);

  // Optionally extend markAsRead to also update Supabase
  const markAsReadDb = useCallback(
    async (id: string) => {
      try {
        markAsRead(id);
        if (!userId) return;
        await markNotificationAsRead(id, userId);
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    },
    [markAsRead, userId]
  );

  const clearAllDb = useCallback(async () => {
    try {
      clearAll();
      if (!userId) return;
      await deleteAllNotifications(userId);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }, [clearAll, userId]);

  const markAllReadDb = useCallback(async () => {
    try {
      markAllAsRead();
      if (!userId) return;
      await markAllNotificationsAsRead(userId);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [markAllAsRead, userId]);

  return {
    notifications,
    unreadCount,
    activeToasts,
    addNotification,
    removeToast,
    markAsRead: markAsReadDb,
    markAllRead: markAllReadDb,
    clearAll: clearAllDb,
  };
}
