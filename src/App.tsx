/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import AppContent from './components/AppContent';
import AppShell from './components/AppShell';
import AppAccessGate from './app/AppAccessGate';
import { getNavigationItems, hasUserPermission } from './navigation/appNavigation';
import { useNavigate } from 'react-router-dom';

import { useNotifications } from './hooks/useNotifications';
import { usePWAInstall } from './hooks/usePWAInstall';
import { useAuthSession } from './hooks/useAuthSession';
import { useAppData } from './hooks/useAppData';
import { usePricingWorkspace } from './hooks/usePricingWorkspace';
import { useAppRoute } from './hooks/useAppRoute';

export default function App() {
  const navigate = useNavigate();
  const { activeModule, activeTab, isPasswordReset, isStandalone } = useAppRoute();
  const navigateHome = React.useCallback(() => navigate('/'), [navigate]);
  const { currentUser, login, logout, updateCurrentUser } = useAuthSession(navigateHome);

  const pricingWorkspace = usePricingWorkspace(navigate);

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

  const hasPermission = React.useCallback(
    (permission: string) => (currentUser ? hasUserPermission(currentUser, permission) : false),
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

  return (
    <AppAccessGate
      currentUser={currentUser}
      isPasswordReset={isPasswordReset}
      onLogin={login}
      onPasswordChanged={updateCurrentUser}
    >
      {(authenticatedUser) => (
        <AppShell
          activeModule={activeModule}
          activeTab={activeTab}
          appSettings={appSettings}
          currentUser={authenticatedUser}
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
          onNavigate={pricingWorkspace.navigateFromShell}
          onOpenNotificationSettings={() => navigate('/settings')}
          onRemoveToast={removeToast}
        >
          <AppContent
            activeModule={activeModule}
            activeTab={activeTab}
            currentUser={authenticatedUser}
            editingPricing={pricingWorkspace.editingPricing}
            initialFormulaContext={pricingWorkspace.initialFormulaContext}
            hasPermission={hasPermission}
            onSelectModule={pricingWorkspace.selectModule}
            onEditPricing={pricingWorkspace.editPricing}
            onCalculatorSaved={pricingWorkspace.calculatorSaved}
            onClearCalculator={pricingWorkspace.clearCalculator}
            onSendFormulaToCalculator={pricingWorkspace.sendFormulaToCalculator}
          />
        </AppShell>
      )}
    </AppAccessGate>
  );
}
