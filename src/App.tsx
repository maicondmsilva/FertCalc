/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import AppAccessGate from './app/AppAccessGate';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuthSession } from './hooks/useAuthSession';
import { useAppRoute } from './hooks/useAppRoute';
import NativeConnectionBanner from './components/NativeConnectionBanner';

const AuthenticatedApp = React.lazy(() => import('./app/AuthenticatedApp'));
const PropostaPublicaPage = React.lazy(() => import('./components/propostas/PropostaPublicaPage'));

/** /proposta/<código>: página do cliente, sem login e sem o restante do sistema. */
function propostaToken(pathname: string): string {
  const [, prefixo, token] = pathname.split('/');
  return prefixo === 'proposta' && token ? decodeURIComponent(token) : '';
}

export default function App() {
  const { pathname } = useLocation();
  const token = propostaToken(pathname);
  if (token) {
    return (
      <React.Suspense
        fallback={
          <div
            role="status"
            className="flex min-h-screen items-center justify-center text-stone-500"
          >
            Abrindo a proposta...
          </div>
        }
      >
        <PropostaPublicaPage token={token} />
      </React.Suspense>
    );
  }
  return <MainApp />;
}

function MainApp() {
  const navigate = useNavigate();
  const { activeModule, activeTab, isPasswordReset, isStandalone } = useAppRoute();
  const navigateHome = React.useCallback(() => navigate('/'), [navigate]);
  const { currentUser, restoring, login, logout, updateCurrentUser } = useAuthSession(navigateHome);

  return (
    <>
      <NativeConnectionBanner />
      <AppAccessGate
        currentUser={currentUser}
        restoring={restoring}
        isPasswordReset={isPasswordReset}
        onLogin={login}
        onPasswordChanged={updateCurrentUser}
        onLogout={logout}
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
    </>
  );
}
