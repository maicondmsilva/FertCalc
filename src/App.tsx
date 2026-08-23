/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import Login from './components/Login';
import ResetPassword from './components/ResetPassword';
import AppContent from './components/AppContent';
import AppSidebar from './components/AppSidebar';
import { ChevronLeft, ChevronRight, Download, Menu } from 'lucide-react';
import { PricingRecord, User, AppSettings, SavedFormula } from './types';
import {
  getActiveModule,
  getNavigationItems,
  hasUserPermission,
} from './navigation/appNavigation';
import { getAppSettings, markNotificationsAsRead } from './services/db';
import { signOut, restoreSession } from './services/authService';
import { logger } from './utils/logger';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from './components/Toast';

import { getPendingCount, getCheckedCount } from './services/expenseService';

import { useNotifications } from './hooks/useNotifications';
import { NotificationBell } from './components/notifications/NotificationBell';
import { usePWAInstall } from './hooks/usePWAInstall';
import { NotificationPanel } from './components/notifications/NotificationPanel';
import { NotificationCard } from './components/notifications/NotificationCard';
import { AnimatePresence } from 'framer-motion';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const isStandalone = useMemo(() => searchParams.get('standalone') === 'true', [searchParams]);
  const pathParts = location.pathname.split('/').filter(Boolean);
  const activeTab = pathParts[0] || '';

  const activeModule = getActiveModule(activeTab);

  const { showInfo } = useToast();
  const [editingPricing, setEditingPricing] = useState<PricingRecord | null>(null);
  const [initialFormulaContext, setInitialFormulaContext] = useState<{
    formula: SavedFormula | null;
    branchId: string;
    priceListId: string;
  }>({ formula: null, branchId: '', priceListId: '' });
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Custom Hook replaces local state and intervals
  const {
    notifications,
    unreadCount,
    activeToasts,
    removeToast,
    markAsRead,
    markAllRead,
    clearAll,
  } = useNotifications(currentUser?.id || '');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    companyName: 'FertCalc Pro',
    companyLogo: '',
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [pendingExpenseCount, setPendingExpenseCount] = useState(0);
  const [checkedExpenseCount, setCheckedExpenseCount] = useState(0);

  useEffect(() => {
    // Restaura sessão via Supabase Auth (seguro — não usa localStorage manual)
    restoreSession().then((user) => {
      if (user) setCurrentUser(user);
    });

    getAppSettings().then((savedSettings) => {
      if (savedSettings?.companyName) {
        setAppSettings(savedSettings);
      }
    });
  }, []);

  // ── PWA install prompt (extraído para usePWAInstall) ─────────────────────
  const { canInstall, handleInstall } = usePWAInstall();

  // ── Logout ───────────────────────────────────────────────────────────────
  const handleLogout = React.useCallback(() => {
    setCurrentUser(null);
    signOut();
    navigate('/');
  }, [navigate]);

  // Sincronizar logout entre abas + fechar menus ao clicar fora
  useEffect(() => {
    if (!currentUser) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && e.key.includes('supabase') && !e.newValue) {
        setCurrentUser(null);
        navigate('/');
      }
    };
    window.addEventListener('storage', handleStorageChange);

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.notification-trigger')) setIsNotificationsOpen(false);
    };
    window.document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [currentUser, navigate]);

  // Load expense badge counts when entering the expenses module
  useEffect(() => {
    if (activeModule !== 'expenses' || !currentUser) return;
    const load = async () => {
      const [p, c] = await Promise.all([getPendingCount(), getCheckedCount()]);
      setPendingExpenseCount(p);
      setCheckedExpenseCount(c);
    };
    load();
  }, [activeModule, currentUser]);

  // handleInstall e canInstall agora vêm do hook usePWAInstall (acima)

  const handleLogin = React.useCallback(
    (user: User) => {
      setCurrentUser(user);
      navigate('/');
      // Sessão gerenciada pelo Supabase Auth — não persiste dados sensíveis no localStorage
    },
    [navigate]
  );

  // handleLogout definido acima (junto ao useInactivityTimer)

  const handleEditPricing = React.useCallback(
    (pricing: PricingRecord) => {
      setEditingPricing(pricing);
      navigate('/calculator');
    },
    [navigate]
  );

  const handleClearEditing = React.useCallback(() => {
    setEditingPricing(null);
  }, []);

  const handleClearEditingAndFormula = React.useCallback(() => {
    setEditingPricing(null);
    setInitialFormulaContext({ formula: null, branchId: '', priceListId: '' });
  }, []);

  const hasPermission = React.useCallback(
    (permission: string) =>
      currentUser ? hasUserPermission(currentUser, permission) : false,
    [currentUser]
  );
  const navItems = useMemo(
    () =>
      getNavigationItems(activeModule, hasPermission, {
        pendingExpenses: pendingExpenseCount,
        checkedExpenses: checkedExpenseCount,
      }),
    [activeModule, checkedExpenseCount, hasPermission, pendingExpenseCount]
  );

  // Rota de redefinição de senha (acessível sem autenticação)
  if (location.pathname === '/reset-password') {
    return <ResetPassword />;
  }

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  if (currentUser.requer_alteracao_senha) {
    return (
      <Login
        onLogin={handleLogin}
        forceChangePasswordUserId={currentUser.id}
        onPasswordChanged={(updatedUser) => setCurrentUser(updatedUser)}
      />
    );
  }

  return (
    <div className="flex h-screen bg-stone-100 overflow-hidden font-sans text-stone-900">
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
        onLogout={handleLogout}
        onNavigate={(routeId, clearFormulaContext) => {
          if (clearFormulaContext) {
            setInitialFormulaContext({ formula: null, branchId: '', priceListId: '' });
          }
          navigate(routeId ? `/${routeId}` : '/');
        }}
      />
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        {!isStandalone && (
          <header className="h-16 bg-white border-b border-stone-200 flex items-center justify-between px-4 sm:px-6">
            <div className="flex items-center">
              {/* Mobile Menu Toggle */}
              <button
                className="md:hidden mr-4 text-stone-500 hover:text-stone-700"
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Abrir menu de navegação"
              >
                <Menu className="w-6 h-6" aria-hidden="true" />
              </button>

              {/* Desktop Sidebar Toggle */}
              <button
                className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
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
                  onClick={handleInstall}
                  className="hidden sm:flex items-center px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-full hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Instalar App
                </button>
              )}

              <div className="relative notification-trigger">
                <NotificationBell
                  unreadCount={unreadCount}
                  onBellClick={() => {
                    const nextState = !isNotificationsOpen;
                    setIsNotificationsOpen(nextState);
                    if (nextState) {
                      markAllRead();
                    }
                  }}
                />

                <NotificationPanel
                  isOpen={isNotificationsOpen}
                  onClose={() => setIsNotificationsOpen(false)}
                  notifications={notifications}
                  unreadCount={unreadCount}
                  onMarkAsRead={(id) => markAsRead(id)}
                  onClearAll={clearAll}
                  onSettings={() => {
                    setIsNotificationsOpen(false);
                    navigate('/settings');
                  }}
                />
              </div>
            </div>
          </header>
        )}

        {/* Main Content Scrollable Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-full mx-auto">
            <AppContent
              activeModule={activeModule}
              activeTab={activeTab}
              currentUser={currentUser}
              editingPricing={editingPricing}
              initialFormulaContext={initialFormulaContext}
              hasPermission={hasPermission}
              onSelectModule={(moduleId) => {
                if (moduleId === 'pricing') navigate('/dashboard');
                if (moduleId === 'config') navigate('/users');
                if (moduleId === 'managementReports') navigate('/managementReports_dashboard');
                if (moduleId === 'prd') navigate('/prd');
                if (moduleId === 'expenses') navigate('/expenses_lancamentos');
                if (moduleId === 'carregamento') navigate('/carregamento_visao_geral');
                if (moduleId === 'relatorios') navigate('/relatorios');
              }}
              onEditPricing={handleEditPricing}
              onCalculatorSaved={() => {
                setEditingPricing(null);
                navigate('/history');
                handleClearEditing();
              }}
              onClearCalculator={handleClearEditingAndFormula}
              onSendFormulaToCalculator={(formula, branchId, priceListId) => {
                setInitialFormulaContext({ formula, branchId, priceListId });
                navigate('/calculator');
              }}
            />
          </div>
        </main>
      </div>

      {/* Floating Notifications (Toasts) */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {activeToasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <NotificationCard notification={toast} onClose={removeToast} autoClose={true} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
