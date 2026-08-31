import { useEffect, useCallback, useRef } from 'react';
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
  const preferencesRef = useRef(preferences);
  const playSoundRef = useRef(playSound);

  useEffect(() => {
    preferencesRef.current = preferences;
    playSoundRef.current = playSound;
  }, [playSound, preferences]);

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

    const unsubscribe = subscribeToNotifications(
      userId,
      (notification) => {
        const currentPreferences = preferencesRef.current;
        // Check if user has completely disabled in-app notifications
        const inAppEnabled = currentPreferences?.in_app_enabled ?? true;
        if (!inAppEnabled) return;

        // Check if this specific group/type is disabled
        if (
          currentPreferences?.disabled_types?.includes(notification.group_type) ||
          currentPreferences?.disabled_types?.includes(notification.type)
        ) {
          return;
        }

        addNotification(notification);

        // Play sound
        const soundEnabled = currentPreferences?.sound_enabled ?? true;
        if (soundEnabled) {
          playSoundRef.current(notification.group_type);
        }
      },
      (status) => {
        // Reconcile events that may have happened while the socket was offline.
        if (status === 'SUBSCRIBED') void loadNotifications();
      }
    );

    return () => {
      unsubscribe();
    };
  }, [addNotification, loadNotifications, prefsLoading, userId]);

  useEffect(() => {
    if (!userId) return;

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void loadNotifications();
    };
    const refreshWhenOnline = () => void loadNotifications();

    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenOnline);
    window.addEventListener('online', refreshWhenOnline);
    return () => {
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenOnline);
      window.removeEventListener('online', refreshWhenOnline);
    };
  }, [loadNotifications, userId]);

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
