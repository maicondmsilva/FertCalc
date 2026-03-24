import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { motion, useAnimation } from 'framer-motion';

interface NotificationBellProps {
  unreadCount: number;
  onBellClick: () => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ 
  unreadCount, 
  onBellClick 
}) => {
  const controls = useAnimation();
  const [prevCount, setPrevCount] = useState(unreadCount);

  useEffect(() => {
    if (unreadCount > prevCount) {
      // Animate rotation (wiggle effect) when new notifications arrive
      controls.start({
        rotate: [0, -15, 15, -15, 15, 0],
        transition: { duration: 0.5 }
      });
    }
    setPrevCount(unreadCount);
  }, [unreadCount, prevCount, controls]);

  return (
    <div className="relative inline-block cursor-pointer" onClick={onBellClick}>
      <motion.div animate={controls}>
        <Bell className="w-6 h-6 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors" />
      </motion.div>
      
      {unreadCount > 0 && (
        <motion.span 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow"
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </motion.span>
      )}
    </div>
  );
};
