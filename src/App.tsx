/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import Login from './components/Login';
import ResetPassword from './components/ResetPassword';
import AppContent from './components/AppContent';
import AppShell from './components/AppShell';
import { PricingRecord, SavedFormula } from './types';
import {
  getActiveModule,
  getNavigationItems,
  hasUserPermission,
} from './navigation/appNavigation';
import { useNavigate, useLocation } from 'react-router-dom';

import { useNotifications } from './hooks/useNotifications';
import { usePWAInstall } from './hooks/usePWAInstall';
import { useAuthSession } from './hooks/useAuthSession';
import { useAppData } from './hooks/useAppData';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const isStandalone = useMemo(() => searchParams.get('standalone') === 'true', [searchParams]);
  const pathParts = location.pathname.split('/').filter(Boolean);
  const activeTab = pathParts[0] || '';

  const activeModule = getActiveModule(activeTab);
  const navigateHome = React.useCallback(() => navigate('/'), [navigate]);
  const { currentUser, login, logout, updateCurrentUser } = useAuthSession(navigateHome);

  const [editingPricing, setEditingPricing] = useState<PricingRecord | null>(null);
  const [initialFormulaContext, setInitialFormulaContext] = useState<{
    formula: SavedFormula | null;
    branchId: string;
    priceListId: string;
  }>({ formula: null, branchId: '', priceListId: '' });

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
  const { appSettings, pendingExpenseCount, checkedExpenseCount } = useAppData(
    activeModule,
    currentUser?.id
  );

  const { canInstall, handleInstall } = usePWAInstall();

  // handleInstall e canInstall agora vêm do hook usePWAInstall (acima)

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
    return <Login onLogin={login} />;
  }

  if (currentUser.requer_alteracao_senha) {
    return (
      <Login
        onLogin={login}
        forceChangePasswordUserId={currentUser.id}
        onPasswordChanged={updateCurrentUser}
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
      onLogout={logout}
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
