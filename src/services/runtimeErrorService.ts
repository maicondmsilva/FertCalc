import { supabase } from './supabase';
import type { RuntimeErrorContext } from '../utils/errorReporter';

export interface RuntimeErrorEvent {
  incidentId: string;
  source: RuntimeErrorContext['source'];
  message: string;
  stack?: string;
  componentStack?: string;
  path?: string;
  userAgent?: string;
  release?: string;
}

function truncate(value: string | undefined, maxLength: number): string | undefined {
  return value ? value.slice(0, maxLength) : undefined;
}

export async function persistRuntimeError(event: RuntimeErrorEvent): Promise<void> {
  const { error } = await supabase.from('runtime_error_events').insert({
    incident_id: event.incidentId,
    source: event.source,
    message: truncate(event.message, 4000),
    stack: truncate(event.stack, 20000),
    component_stack: truncate(event.componentStack, 20000),
    path: truncate(event.path, 2000),
    user_agent: truncate(event.userAgent, 1000),
    release: truncate(event.release, 200),
  });

  if (error && error.code !== '23505') throw error;
}
