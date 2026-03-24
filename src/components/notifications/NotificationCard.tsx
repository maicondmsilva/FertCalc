import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, CheckCircle, Edit, ArrowRightLeft, Info, Trash2 } from 'lucide-react';
import { Notification, NotificationType } from '../../types/notification.types';

interface NotificationCardProps {
  notification: Notification;
  onClose: (id: string) => void;
  autoClose?: boolean;
}

export const NotificationCard: React.FC<NotificationCardProps> = ({ 
  notification, 
  onClose, 
  autoClose = true 
}) => {
  useEffect(() => {
    if (autoClose) {
      const timer = setTimeout(() => {
        onClose(notification.id);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [autoClose, notification.id, onClose]);

  const getStyle = () => {
    switch (notification.type) {
      case NotificationType.PRICING_CREATED:
        return {
          bg: 'bg-green-50 dark:bg-green-900/20',
          border: 'border-green-500',
          icon: <CheckCircle className="w-5 h-5 text-green-500" />,
          text: 'text-green-800 dark:text-green-300'
        };
      case NotificationType.PRICING_UPDATED:
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          border: 'border-blue-500',
          icon: <Edit className="w-5 h-5 text-blue-500" />,
          text: 'text-blue-800 dark:text-blue-300'
        };
      case NotificationType.PRICING_DELETED:
        return {
          bg: 'bg-red-50 dark:bg-red-900/20',
          border: 'border-red-500',
          icon: <Trash2 className="w-5 h-5 text-red-500" />,
          text: 'text-red-800 dark:text-red-300'
        };
      case NotificationType.TRANSFER_ACCEPTED:
        return {
          bg: 'bg-yellow-50 dark:bg-yellow-900/20',
          border: 'border-yellow-500',
          icon: <ArrowRightLeft className="w-5 h-5 text-yellow-500" />,
          text: 'text-yellow-800 dark:text-yellow-300'
        };
      case NotificationType.SYSTEM_INFO:
      default:
        return {
          bg: 'bg-gray-50 dark:bg-gray-800',
          border: 'border-gray-500',
          icon: <Info className="w-5 h-5 text-gray-500 dark:text-gray-400" />,
          text: 'text-gray-800 dark:text-gray-300'
        };
    }
  };

  const style = getStyle();

  const handleClick = (e: React.MouseEvent) => {
    if (notification.action_url) {
      // Handle navigation logic or just let the user handle it
      // Replace this with standard router navigation if needed
      window.location.href = notification.action_url;
    }
  };

  const handleCloseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose(notification.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className={`relative w-80 p-4 rounded-lg border-l-4 shadow-lg mb-3 cursor-pointer ${style.bg} ${style.border}`}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            {style.icon}
          </div>
          <div className="flex-1">
            <h4 className={`text-sm font-semibold ${style.text}`}>
              {notification.title}
            </h4>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              {notification.message}
            </p>
          </div>
        </div>
        <button
          onClick={handleCloseClick}
          className="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {notification.action_url && (
        <div className="mt-2 text-right">
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
            Visualizar
          </span>
        </div>
      )}
    </motion.div>
  );
};
