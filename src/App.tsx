/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import AppAccessGate from './app/AppAccessGate';
import AuthenticatedApp from './app/AuthenticatedApp';
import { useNavigate } from 'react-router-dom';

import { useAuthSession } from './hooks/useAuthSession';
import { useAppRoute } from './hooks/useAppRoute';

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
        <AuthenticatedApp
          activeModule={activeModule}
          activeTab={activeTab}
          currentUser={authenticatedUser}
          isStandalone={isStandalone}
          onLogout={logout}
        />
      )}
    </AppAccessGate>
  );
}
