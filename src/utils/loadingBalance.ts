import type { Carregamento, ExecucaoCarregamento } from '../types/carregamento';

const tons = (value: number) => Math.max(0, Math.round(value * 1000) / 1000);

export function loadingBalance(
  loading: Pick<
    Carregamento,
    'quantidade_total' | 'quantidade_liberada' | 'quantidade_carregada' | 'quantidade_cancelada'
  >,
  executions?: ExecucaoCarregamento[]
) {
  const total = Number(loading.quantidade_total || 0);
  const cancelled = Number(loading.quantidade_cancelada || 0);
  const net = tons(total - cancelled);
  // Cancelamento reduz primeiro o volume ainda não liberado.
  const released = Math.min(Number(loading.quantidade_liberada || 0), net);
  const loaded = executions
    ? executions
        .filter((e) => e.status === 'concluido')
        .reduce((sum, e) => sum + Number(e.quantidade_carregada || 0), 0)
    : Number(loading.quantidade_carregada || 0);
  const reserved = (executions || [])
    .filter((e) => e.status === 'agendado' || e.status === 'em_carregamento')
    .reduce((sum, e) => sum + Number(e.quantidade_agendada || 0), 0);
  return {
    total,
    cancelled,
    loaded,
    reserved,
    awaitingRelease: tons(net - released),
    available: tons(released - loaded - reserved),
    cancellable: tons(net - loaded - reserved),
    releasedRemaining: tons(released - loaded),
  };
}
