import { useCallback, useEffect, useState } from 'react';
import { Activity, CheckCircle2, CircleAlert, RefreshCw, XCircle } from 'lucide-react';
import {
  runSystemHealthChecks,
  type HealthStatus,
  type SystemHealthSnapshot,
} from '../services/healthCheckService';

const STATUS_PRESENTATION: Record<
  HealthStatus,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  operational: {
    label: 'Operacional',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: CheckCircle2,
  },
  degraded: {
    label: 'Atenção',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: CircleAlert,
  },
  unavailable: {
    label: 'Indisponível',
    className: 'bg-red-50 text-red-700 border-red-200',
    icon: XCircle,
  },
};

export default function SystemHealthPanel() {
  const [snapshot, setSnapshot] = useState<SystemHealthSnapshot | null>(null);
  const [checking, setChecking] = useState(false);

  const checkHealth = useCallback(async () => {
    setChecking(true);
    try {
      setSnapshot(await runSystemHealthChecks());
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkHealth();
  }, [checkHealth]);

  const overall = snapshot ? STATUS_PRESENTATION[snapshot.status] : null;

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-stone-800">
            <Activity className="h-5 w-5 text-emerald-600" />
            Saúde do sistema
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Diagnóstico somente de leitura da aplicação e dos serviços essenciais.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void checkHealth()}
          disabled={checking}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-stone-800 px-4 py-2 text-sm font-bold text-white hover:bg-stone-900 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Verificando...' : 'Verificar novamente'}
        </button>
      </div>

      {snapshot && overall && (
        <>
          <div
            className={`mt-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-bold ${overall.className}`}
          >
            <overall.icon className="h-4 w-4" />
            Sistema {overall.label.toLowerCase()}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {snapshot.checks.map((check) => {
              const presentation = STATUS_PRESENTATION[check.status];
              const StatusIcon = presentation.icon;
              return (
                <article key={check.id} className="rounded-xl border border-stone-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-stone-700">{check.label}</h3>
                      <p className="mt-1 text-xs leading-5 text-stone-500">{check.detail}</p>
                    </div>
                    <StatusIcon
                      className={`h-5 w-5 shrink-0 ${presentation.className.split(' ')[1]}`}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-stone-400">
                    <span>{presentation.label}</span>
                    {check.latencyMs !== undefined && <span>{check.latencyMs} ms</span>}
                  </div>
                </article>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-stone-400">
            Última verificação: {new Date(snapshot.checkedAt).toLocaleString('pt-BR')}
          </p>
        </>
      )}
    </section>
  );
}
