/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import Login from './components/Login';
import ResetPassword from './components/ResetPassword';
import AppContent from './components/AppContent';
import AppShell from './components/AppShell';
import { PricingRecord, User, AppSettings, SavedFormula } from './types';
import {
  getActiveModule,
  getNavigationItems,
  hasUserPermission,
} from './navigation/appNavigation';
import { getAppSettings } from './services/db';
import { signOut, restoreSession } from './services/authService';
import { useNavigate, useLocation } from 'react-router-dom';

import { getPendingCount, getCheckedCount } from './services/expenseService';

import { useNotifications } from './hooks/useNotifications';
import { usePWAInstall } from './hooks/usePWAInstall';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const isStandalone = useMemo(() => searchParams.get('standalone') === 'true', [searchParams]);
  const pathParts = location.pathname.split('/').filter(Boolean);
  const activeTab = pathParts[0] || '';

  const activeModule = getActiveModule(activeTab);

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
  const [appSettings, setAppSettings] = useState<AppSettings>({
    companyName: 'FertCalc Pro',
    companyLogo: '',
  });
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

  const { canInstall, handleInstall } = usePWAInstall();

  // ── Logout ───────────────────────────────────────────────────────────────
  const handleLogout = React.useCallback(() => {
    setCurrentUser(null);
    signOut();
    navigate('/');
  }, [navigate]);

  // Sincronizar logout entre abas
  useEffect(() => {
    if (!currentUser) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && e.key.includes('supabase') && !e.newValue) {
        setCurrentUser(null);
        navigate('/');
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
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
    <AppShell
      activeModule={activeModule}
      activeTab={activeTab}
      appSettings={appSettings}
      currentUser={currentUser}
      isStandalone={isStandalone}
      navItems={navItems}
      hasPermission={hasPermission}
      notifications={notifications}
      unreadCount={unreadCount}
      activeToasts={activeToasts}
      canInstall={canInstall}
      onClearNotifications={clearAll}
      onInstall={handleInstall}
      onLogout={handleLogout}
      onMarkAllNotificationsRead={markAllRead}
      onMarkNotificationRead={markAsRead}
      onNavigate={(routeId, clearFormulaContext) => {
        if (clearFormulaContext) {
          setInitialFormulaContext({ formula: null, branchId: '', priceListId: '' });
        }
        navigate(routeId ? `/${routeId}` : '/');
      }}
      onOpenNotificationSettings={() => navigate('/settings')}
      onRemoveToast={removeToast}
    >
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
    </AppShell>
  );
}
