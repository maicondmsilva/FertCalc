import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, Edit, ArrowRightLeft, Info, Trash2, Settings } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Notification, NotificationType } from '../../types/notification.types';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  unreadCount?: number;
  onMarkAsRead: (id: string) => void;
  onClearAll: () => void;
  onSettings?: () => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen,
  onClose,
  notifications,
  unreadCount = 0,
  onMarkAsRead,
  onClearAll,
  onSettings
}) => {
  const getIcon = (type: string) => {
    switch (type) {
      case NotificationType.PRICING_CREATED:
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case NotificationType.PRICING_UPDATED:
        return <Edit className="w-4 h-4 text-blue-500" />;
      case NotificationType.PRICING_DELETED:
        return <Trash2 className="w-4 h-4 text-red-500" />;
      case NotificationType.TRANSFER_ACCEPTED:
        return <ArrowRightLeft className="w-4 h-4 text-yellow-500" />;
      case NotificationType.SYSTEM_INFO:
      default:
        return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  const navigate = useNavigate();
  
  const handleNotificationClick = (e: React.MouseEvent, notification: Notification) => {
    e.stopPropagation();
    onMarkAsRead(notification.id);
    if (notification.action_url) {
      navigate(notification.action_url);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <React.Fragment>
          {/* Backdrop for closing when clicking outside */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-12 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center">
                Notificações
                {unreadCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </h3>
              <button 
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                  Nenhuma notificação por enquanto.
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {notifications.map((notification) => (
                    <li 
                      key={notification.id}
                      onClick={(e) => handleNotificationClick(e, notification)}
                      className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${
                        !notification.is_read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                      }`}
                    >
                      <div className="flex space-x-3">
                        <div className="flex-shrink-0 mt-1">
                          {getIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${!notification.is_read ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                            {notification.title}
                          </p>
                          <p className={`text-sm mt-1 line-clamp-2 ${!notification.is_read ? 'text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}>
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                        {!notification.is_read && (
                          <div className="flex-shrink-0">
                            <span className="inline-block w-2.5 h-2.5 bg-blue-500 rounded-full"></span>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            {(notifications.length > 0 || unreadCount > 0) && (
              <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center text-sm">
                <button 
                  onClick={onClearAll}
                  className="text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 font-medium transition-colors"
                >
                  Limpar Tudo
                </button>
                <button 
                  onClick={() => {
                    if (onSettings) onSettings();
                    else navigate('/settings');
                    onClose();
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center"
                >
                  <Settings className="w-4 h-4 mr-1" />
                  Configurar
                </button>
              </div>
            )}
          </motion.div>
        </React.Fragment>
      )}
    </AnimatePresence>
  );
};
