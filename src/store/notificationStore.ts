import { create } from 'zustand';
import { Notification } from '../types/notification.types';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  activeToasts: Notification[];
  addNotification: (notification: Notification) => void;
  removeToast: (id: string) => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
  setNotifications: (notifications: Notification[]) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  activeToasts: [],
  
  addNotification: (notification) => set((state) => ({
    // Keep only the latest 5 notifications as per the panel UI requirements (or just slice to 5 for now)
    notifications: [notification, ...state.notifications].slice(0, 5),
    unreadCount: state.unreadCount + 1,
    activeToasts: [notification, ...state.activeToasts].slice(0, 3)
  })),

  removeToast: (id) => set((state) => ({
    activeToasts: state.activeToasts.filter(t => t.id !== id)
  })),
  
  // Marca uma como lida e decrementa a contagem de não lidas apenas se ela estava como não lida
  markAsRead: (id) => set((state) => {
    const notification = state.notifications.find(n => n.id === id);
    if (!notification || notification.is_read) return state; // Se não encontrou ou já está lida, não faz nada
    return {
      notifications: state.notifications.map(n =>
        n.id === id ? { ...n, is_read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1)
    };
  }),

  // Define todas as notificações iniciais
  setNotifications: (notifications) => set({
    notifications: notifications.slice(0, 5),
    unreadCount: notifications.filter(n => !n.is_read).length
  }),
  
  clearAll: () => set({ notifications: [], unreadCount: 0 })
}));
