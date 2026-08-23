import { logger } from './logger';

export interface RuntimeErrorContext {
  incidentId: string;
  componentStack?: string;
  source: 'react-error-boundary' | 'window-error' | 'unhandled-rejection';
}

export function createIncidentId(): string {
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `FERT-${Date.now().toString(36).toUpperCase()}-${randomPart.toUpperCase()}`;
}

export function reportRuntimeError(error: unknown, context: RuntimeErrorContext): void {
  const normalizedError = error instanceof Error ? error : new Error(String(error));
  logger.error('[runtime_error]', {
    incidentId: context.incidentId,
    source: context.source,
    message: normalizedError.message,
    stack: normalizedError.stack,
    componentStack: context.componentStack,
    path: typeof window !== 'undefined' ? window.location.pathname : undefined,
    occurredAt: new Date().toISOString(),
  });
}
