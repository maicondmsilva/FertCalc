import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { createIncidentId, reportRuntimeError } from '../utils/errorReporter';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
  incidentId: string | null;
}

export default class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null, incidentId: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error, incidentId: createIncidentId() };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportRuntimeError(error, {
      incidentId: this.state.incidentId || createIncidentId(),
      componentStack: info.componentStack || undefined,
      source: 'react-error-boundary',
    });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="min-h-screen bg-stone-100 flex items-center justify-center p-6">
        <section
          role="alert"
          className="w-full max-w-lg rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-xl"
        >
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <h1 className="text-2xl font-black text-stone-800">Não foi possível exibir esta tela</h1>
          <p className="mt-3 text-sm leading-6 text-stone-500">
            O erro foi registrado. Você pode tentar recarregar a aplicação ou voltar ao início.
          </p>
          <p className="mt-4 rounded-xl bg-stone-100 px-4 py-3 font-mono text-xs text-stone-600">
            Incidente: {this.state.incidentId}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700"
            >
              <RefreshCw className="h-4 w-4" />
              Recarregar
            </button>
            <a
              href="/"
              className="flex items-center justify-center gap-2 rounded-xl border border-stone-300 px-4 py-3 text-sm font-bold text-stone-700 hover:bg-stone-50"
            >
              <Home className="h-4 w-4" />
              Voltar ao início
            </a>
          </div>
        </section>
      </main>
    );
  }
}
