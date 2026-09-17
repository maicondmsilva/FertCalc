/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import AppAccessGate from './app/AppAccessGate';
import { useNavigate } from 'react-router-dom';

import { useAuthSession } from './hooks/useAuthSession';
import { useAppRoute } from './hooks/useAppRoute';

const AuthenticatedApp = React.lazy(() => import('./app/AuthenticatedApp'));

export default function App() {
  const navigate = useNavigate();
  const { activeModule, activeTab, isPasswordReset, isStandalone } = useAppRoute();
  const navigateHome = React.useCallback(() => navigate('/'), [navigate]);
  const { currentUser, login, logout, updateCurrentUser } = useAuthSession(navigateHome);

  return (
    <AppAccessGate
      currentUser={currentUser}
      isPasswordReset={isPasswordReset}
      onLogin={login}
      onPasswordChanged={updateCurrentUser}
    >
      {(authenticatedUser) => (
        <React.Suspense
          fallback={
            <div
              role="status"
              className="flex min-h-screen items-center justify-center text-stone-500"
            >
              Carregando aplicação...
            </div>
          }
        >
          <AuthenticatedApp
            activeModule={activeModule}
            activeTab={activeTab}
            currentUser={authenticatedUser}
            isStandalone={isStandalone}
            onLogout={logout}
          />
        </React.Suspense>
      )}
    </AppAccessGate>
  );
}
