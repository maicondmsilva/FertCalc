import { create } from 'zustand';
import { Notification } from '../types/notification.types';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  activeToasts: Notification[];
  addNotification: (notification: Notification) => void;
  removeToast: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  setNotifications: (notifications: Notification[]) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  activeToasts: [],

  addNotification: (notification) =>
    set((state) => {
      if (state.notifications.some((item) => item.id === notification.id)) return state;

      return {
        notifications: [notification, ...state.notifications].slice(0, 20),
        unreadCount: state.unreadCount + (notification.is_read ? 0 : 1),
        activeToasts: notification.is_read
          ? state.activeToasts
          : [notification, ...state.activeToasts].slice(0, 3),
      };
    }),

  removeToast: (id) =>
    set((state) => ({
      activeToasts: state.activeToasts.filter((t) => t.id !== id),
    })),

  // Marca uma como lida e decrementa a contagem de não lidas apenas se ela estava como não lida
  markAsRead: (id) =>
    set((state) => {
      const notification = state.notifications.find((n) => n.id === id);
      if (!notification || notification.is_read) return state; // Se não encontrou ou já está lida, não faz nada
      return {
        notifications: state.notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
        unreadCount: Math.max(0, state.unreadCount - 1),
      };
    }),

  // Define todas as notificações iniciais
  setNotifications: (notifications) => {
    const unique = Array.from(new Map(notifications.map((item) => [item.id, item])).values());
    set({
      notifications: unique.slice(0, 20),
      unreadCount: unique.filter((n) => !n.is_read).length,
    });
  },

  clearAll: () => set({ notifications: [], unreadCount: 0 }),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    })),
}));
