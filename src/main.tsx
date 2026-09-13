import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import AppProviders from './app/AppProviders.tsx';
import AppErrorBoundary from './components/AppErrorBoundary.tsx';
import { createIncidentId, reportRuntimeError } from './utils/errorReporter.ts';
import { clearVersionRecoveryMarker, recoverOnceFromStaleDeployment } from './utils/appRecovery.ts';

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  recoverOnceFromStaleDeployment();
});

window.addEventListener('error', (event) => {
  reportRuntimeError(event.error ?? new Error(event.message), {
    incidentId: createIncidentId(),
    source: 'window-error',
  });
});

window.addEventListener('unhandledrejection', (event) => {
  reportRuntimeError(event.reason, {
    incidentId: createIncidentId(),
    source: 'unhandled-rejection',
  });
});

window.setTimeout(clearVersionRecoveryMarker, 10_000);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <AppProviders>
        <App />
      </AppProviders>
    </AppErrorBoundary>
  </StrictMode>
);
