import { lazy, Suspense, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '../types';
import type { ActiveModule } from '../navigation/appNavigation';
import { getNavigationItems, hasUserPermission } from '../navigation/appNavigation';
import AppContent from '../components/AppContent';
import AppShell from '../components/AppShell';
import { useAppData } from '../hooks/useAppData';
import { useNotifications } from '../hooks/useNotifications';
import { usePricingWorkspace } from '../hooks/usePricingWorkspace';
import { usePWAInstall } from '../hooks/usePWAInstall';

const PortalTransportadora = lazy(() => import('../components/PortalTransportadora'));

interface AuthenticatedAppProps {
  activeModule: ActiveModule;
  activeTab: string;
  currentUser: User;
  isStandalone: boolean;
  onLogout: () => void;
}

function InternalAuthenticatedApp({
  activeModule,
  activeTab,
  currentUser,
  isStandalone,
  onLogout,
}: AuthenticatedAppProps) {
  const navigate = useNavigate();
  const pricingWorkspace = usePricingWorkspace(navigate);
  const {
    notifications,
    unreadCount,
    activeToasts,
    removeToast,
    markAsRead,
    markAllRead,
    clearAll,
  } = useNotifications(currentUser.id);
  const { appSettings, pendingExpenseCount, checkedExpenseCount } = useAppData(
    activeModule,
    currentUser.id
  );
  const { canInstall, handleInstall } = usePWAInstall();

  const hasPermission = useCallback(
    (permission: string) => hasUserPermission(currentUser, permission),
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
      onLogout={onLogout}
      onMarkAllNotificationsRead={markAllRead}
      onMarkNotificationRead={markAsRead}
      onNavigate={pricingWorkspace.navigateFromShell}
      onOpenNotificationSettings={() => navigate('/settings')}
      onRemoveToast={removeToast}
    >
      <AppContent
        activeModule={activeModule}
        activeTab={activeTab}
        currentUser={currentUser}
        editingPricing={pricingWorkspace.editingPricing}
        initialFormulaContext={pricingWorkspace.initialFormulaContext}
        hasPermission={hasPermission}
        onSelectModule={pricingWorkspace.selectModule}
        onEditPricing={pricingWorkspace.editPricing}
        onCalculatorSaved={pricingWorkspace.calculatorSaved}
        onClearCalculator={pricingWorkspace.clearCalculator}
      />
    </AppShell>
  );
}

export default function AuthenticatedApp(props: AuthenticatedAppProps) {
  if (props.currentUser.role === 'transportadora') {
    return (
      <Suspense
        fallback={
          <div
            role="status"
            className="flex min-h-screen items-center justify-center text-stone-500"
          >
            Carregando portal da transportadora...
          </div>
        }
      >
        <PortalTransportadora currentUser={props.currentUser} onLogout={props.onLogout} />
      </Suspense>
    );
  }
  return <InternalAuthenticatedApp {...props} />;
}
