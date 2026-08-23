import { supabase } from './supabase';

export type HealthStatus = 'operational' | 'degraded' | 'unavailable';

export interface HealthCheckResult {
  id: 'configuration' | 'network' | 'authentication' | 'database';
  label: string;
  status: HealthStatus;
  latencyMs?: number;
  detail: string;
}

export interface SystemHealthSnapshot {
  status: HealthStatus;
  checkedAt: string;
  checks: HealthCheckResult[];
}

const HEALTH_TIMEOUT_MS = 8000;

async function withTimeout<T>(operation: PromiseLike<T>): Promise<T> {
  return Promise.race([
    Promise.resolve(operation),
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('Tempo limite excedido')), HEALTH_TIMEOUT_MS);
    }),
  ]);
}

function elapsedSince(startedAt: number): number {
  return Math.max(0, Math.round(window.performance.now() - startedAt));
}

export async function runSystemHealthChecks(): Promise<SystemHealthSnapshot> {
  const checks: HealthCheckResult[] = [];
  const hasConfiguration = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  checks.push({
    id: 'configuration',
    label: 'Configuração da aplicação',
    status: hasConfiguration ? 'operational' : 'unavailable',
    detail: hasConfiguration
      ? 'Variáveis necessárias estão configuradas.'
      : 'Configuração de conexão incompleta.',
  });

  const isOnline = typeof navigator === 'undefined' || navigator.onLine;
  checks.push({
    id: 'network',
    label: 'Conexão deste dispositivo',
    status: isOnline ? 'operational' : 'unavailable',
    detail: isOnline ? 'O navegador informa conexão ativa.' : 'O dispositivo está sem conexão.',
  });

  if (hasConfiguration && isOnline) {
    const authStartedAt = window.performance.now();
    try {
      const { data, error } = await withTimeout(supabase.auth.getUser());
      if (error) throw error;
      checks.push({
        id: 'authentication',
        label: 'Autenticação',
        status: data.user ? 'operational' : 'degraded',
        latencyMs: elapsedSince(authStartedAt),
        detail: data.user ? 'Sessão validada pelo serviço.' : 'Não há sessão autenticada.',
      });
    } catch {
      checks.push({
        id: 'authentication',
        label: 'Autenticação',
        status: 'unavailable',
        latencyMs: elapsedSince(authStartedAt),
        detail: 'O serviço de autenticação não respondeu corretamente.',
      });
    }

    const databaseStartedAt = window.performance.now();
    try {
      const { error } = await withTimeout(supabase.from('app_users').select('id').limit(1));
      if (error) throw error;
      checks.push({
        id: 'database',
        label: 'Banco de dados',
        status: 'operational',
        latencyMs: elapsedSince(databaseStartedAt),
        detail: 'Consulta segura de leitura concluída.',
      });
    } catch {
      checks.push({
        id: 'database',
        label: 'Banco de dados',
        status: 'unavailable',
        latencyMs: elapsedSince(databaseStartedAt),
        detail: 'Não foi possível concluir a consulta de leitura.',
      });
    }
  } else {
    checks.push(
      {
        id: 'authentication',
        label: 'Autenticação',
        status: 'unavailable',
        detail: 'Verificação não executada por falta de conexão ou configuração.',
      },
      {
        id: 'database',
        label: 'Banco de dados',
        status: 'unavailable',
        detail: 'Verificação não executada por falta de conexão ou configuração.',
      }
    );
  }

  const status = checks.some((check) => check.status === 'unavailable')
    ? 'unavailable'
    : checks.some((check) => check.status === 'degraded')
      ? 'degraded'
      : 'operational';

  return { status, checkedAt: new Date().toISOString(), checks };
}
