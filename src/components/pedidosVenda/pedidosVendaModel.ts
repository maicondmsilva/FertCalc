import type { CancelamentoPedido, PedidoVenda } from '../../types';
import type { PedidoVendaAuditEntry } from '../../services/pedidosVendaService';

export const STATUS_LABEL: Record<PedidoVenda['status'], string> = {
  pendente: 'Ativo',
  em_carregamento: 'Em carregamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

export const STATUS_STYLE: Record<PedidoVenda['status'], string> = {
  pendente: 'bg-emerald-100 text-emerald-800',
  em_carregamento: 'bg-violet-100 text-violet-800',
  concluido: 'bg-blue-100 text-blue-800',
  cancelado: 'bg-red-100 text-red-800',
};

const DAY_MS = 86_400_000;

/** Toneladas com até 3 casas, no formato brasileiro. */
export const formatTon = (value?: number | null) =>
  `${(Number(value) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} t`;

export const formatMoney = (value?: number | null) =>
  (Number(value) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });

/** Data "aaaa-mm-dd" ou ISO para dd/mm/aaaa, sem deslocar o dia pelo fuso. */
export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR');
}

/** Identificação do pedido como o usuário conhece: barra ou número/emitente. */
export function pedidoLabel(
  pedido: Pick<PedidoVenda, 'barra_pedido' | 'numero_pedido' | 'emitente'>
) {
  if (pedido.barra_pedido) return pedido.barra_pedido;
  if (pedido.numero_pedido) return `${pedido.numero_pedido}/${pedido.emitente ?? 1}`;
  return 'Sem número';
}

/** Quantidade vendida (original), carregada, saldo a carregar e % carregado. */
export function pedidoProgress(pedido: PedidoVenda) {
  const total = Math.max(
    0,
    Number(pedido.quantidade_original ?? pedido.quantidade_real ?? 0) -
      Number(pedido.quantidade_desmembrada ?? 0) -
      Number(pedido.quantidade_cancelada_definitiva ?? 0)
  );
  const carregado = Math.max(0, Number(pedido.quantidade_carregada ?? 0));
  const saldo = Math.max(0, Number(pedido.saldo_a_carregar ?? total - carregado));
  const percent = total > 0 ? Math.min(100, (carregado / total) * 100) : 0;
  return { total, carregado, saldo, percent };
}

/** Dias desde a última movimentação (criação ou solicitação de carga). */
export function diasSemMovimento(pedido: PedidoVenda, now = new Date()): number {
  const reference = pedido.ultima_movimentacao || pedido.criado_em;
  if (!reference) return 0;
  const time = new Date(reference).getTime();
  return Number.isNaN(time) ? 0 : Math.max(0, Math.floor((now.getTime() - time) / DAY_MS));
}

/** Pedido com saldo a carregar e sem movimento há pelo menos `dias`. */
export const isPedidoParado = (pedido: PedidoVenda, dias = 30, now = new Date()) =>
  (pedido.status === 'pendente' || pedido.status === 'em_carregamento') &&
  pedidoProgress(pedido).saldo > 0 &&
  diasSemMovimento(pedido, now) >= dias;

export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  detail?: string;
  tone: 'neutral' | 'warning' | 'danger' | 'success';
}

const FIELD_LABEL: Record<string, string> = {
  safra: 'safra',
  previsao_entrega: 'previsão de entrega',
  local_entrega: 'local de entrega',
  numero_contrato: 'contrato',
};

/** Linha do tempo do pedido: criação, edições e cancelamentos, do mais recente ao mais antigo. */
export function buildPedidoTimeline(
  pedido: PedidoVenda,
  audit: PedidoVendaAuditEntry[],
  cancelamentos: CancelamentoPedido[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  if (pedido.criado_em) {
    events.push({
      id: `criado-${pedido.id}`,
      date: pedido.criado_em,
      title: 'Pedido lançado',
      detail: pedido.vendedor_nome ? `por ${pedido.vendedor_nome}` : undefined,
      tone: 'success',
    });
  }
  audit.forEach((entry) => {
    const fields = (entry.campos_alterados || [])
      .map((field) => FIELD_LABEL[field] || field.replace(/_/g, ' '))
      .join(', ');
    events.push({
      id: `audit-${entry.id}`,
      date: entry.criado_em,
      title: entry.motivo || 'Pedido editado',
      detail: fields ? `Alterado: ${fields}` : undefined,
      tone: 'neutral',
    });
  });
  cancelamentos.forEach((item) => {
    const quantidade = formatTon(item.quantidade);
    events.push({
      id: `canc-${item.id}`,
      date: item.criado_em,
      title:
        item.tipo === 'definitivo'
          ? `Cancelamento definitivo de ${quantidade}`
          : `Canc/Substitui de ${quantidade}`,
      detail: [item.motivo, item.usuario_nome ? `por ${item.usuario_nome}` : '']
        .filter(Boolean)
        .join(' · '),
      tone: item.tipo === 'definitivo' ? 'danger' : 'warning',
    });
  });
  return events.sort(
    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()
  );
}
