import React, { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Download, Menu } from 'lucide-react';
import type { ActiveModule } from '../navigation/appNavigation';
import type { AppSettings, NavItem, User } from '../types';
import type { Notification } from '../types/notification.types';
import { NotificationBell } from './notifications/NotificationBell';
import { NotificationCard } from './notifications/NotificationCard';
import { NotificationPanel } from './notifications/NotificationPanel';
import AppSidebar from './AppSidebar';
import ChatWidget from './chat/ChatWidget';

interface AppShellProps {
  activeModule: ActiveModule;
  activeTab: string;
  appSettings: AppSettings;
  currentUser: User;
  isStandalone: boolean;
  navItems: NavItem[];
  hasPermission: (permission: string) => boolean;
  notifications: Notification[];
  unreadCount: number;
  activeToasts: Notification[];
  canInstall: boolean;
  onClearNotifications: () => void;
  onInstall: () => void;
  onLogout: () => void;
  onMarkAllNotificationsRead: () => void;
  onMarkNotificationRead: (id: string) => void;
  onNavigate: (routeId: string, clearFormulaContext: boolean) => void;
  onOpenNotificationSettings: () => void;
  onRemoveToast: (id: string) => void;
  children: React.ReactNode;
}

export default function AppShell({
  activeModule,
  activeTab,
  appSettings,
  currentUser,
  isStandalone,
  navItems,
  hasPermission,
  notifications,
  unreadCount,
  activeToasts,
  canInstall,
  onClearNotifications,
  onInstall,
  onLogout,
  onMarkAllNotificationsRead,
  onMarkNotificationRead,
  onNavigate,
  onOpenNotificationSettings,
  onRemoveToast,
  children,
}: AppShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const canUseChat =
    currentUser.role === 'master' ||
    currentUser.role === 'admin' ||
    currentUser.permissions?.chat_access === true;

  useEffect(() => {
    const closeNotifications = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.notification-trigger')) {
        setIsNotificationsOpen(false);
      }
    };
    window.document.addEventListener('mousedown', closeNotifications);
    return () => window.document.removeEventListener('mousedown', closeNotifications);
  }, []);

  return (
    <div className="app-safe-x flex h-[100dvh] min-h-0 overflow-hidden bg-stone-100 font-sans text-stone-900">
      <AppSidebar
        activeModule={activeModule}
        activeTab={activeTab}
        appSettings={appSettings}
        currentUser={currentUser}
        isExpanded={isSidebarExpanded}
        isMobileOpen={isMobileMenuOpen}
        isStandalone={isStandalone}
        navItems={navItems}
        hasPermission={hasPermission}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onLogout={onLogout}
        onNavigate={onNavigate}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {!isStandalone && (
          <header className="app-safe-top min-h-16 shrink-0 border-b border-stone-200 bg-white px-4 sm:px-6 flex items-center justify-between">
            <div className="flex items-center">
              <button
                className="md:hidden mr-4 text-stone-500 hover:text-stone-700"
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Abrir menu de navegação"
              >
                <Menu className="w-6 h-6" aria-hidden="true" />
              </button>

              <button
                className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                onClick={() => setIsSidebarExpanded((current) => !current)}
                aria-label={isSidebarExpanded ? 'Recolher menu lateral' : 'Expandir menu lateral'}
              >
                {isSidebarExpanded ? (
                  <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <ChevronRight className="w-5 h-5" aria-hidden="true" />
                )}
              </button>
            </div>

            <div className="flex items-center gap-4">
              {canInstall && (
                <button
                  onClick={onInstall}
                  className="hidden sm:flex items-center px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-full hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Instalar App
                </button>
              )}

              {canUseChat && <ChatWidget currentUser={currentUser} />}

              <div className="relative notification-trigger">
                <NotificationBell
                  unreadCount={unreadCount}
                  onBellClick={() => {
                    const nextState = !isNotificationsOpen;
                    setIsNotificationsOpen(nextState);
                    if (nextState) onMarkAllNotificationsRead();
                  }}
                />

                <NotificationPanel
                  isOpen={isNotificationsOpen}
                  onClose={() => setIsNotificationsOpen(false)}
                  notifications={notifications}
                  unreadCount={unreadCount}
                  onMarkAsRead={onMarkNotificationRead}
                  onClearAll={onClearNotifications}
                  onSettings={() => {
                    setIsNotificationsOpen(false);
                    onOpenNotificationSettings();
                  }}
                />
              </div>
            </div>
          </header>
        )}

        <main className="app-safe-bottom min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-6 sm:p-6 lg:p-8">
          <div className="max-w-full mx-auto">{children}</div>
        </main>
      </div>

      <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-[9999] flex max-w-[calc(100vw-2rem)] flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {activeToasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <NotificationCard notification={toast} onClose={onRemoveToast} autoClose={true} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
