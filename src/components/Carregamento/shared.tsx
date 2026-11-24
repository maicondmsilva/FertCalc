import React from 'react';
import { User, PricingRecord, PedidoVenda, PedidoVendaItem } from '../../types';
import { Carregamento, Filial, StatusCarregamento } from '../../types/carregamento';
import { formatCarregamentoId } from '../../utils/formatId';

// ─── Permission helper ────────────────────────────────────────────────────────
const ROLE_LEVEL: Record<string, number> = {
  master: 100,
  admin: 80,
  manager: 60,
  user: 40,
  comercial: 20,
  transportadora: 10,
};

/**
 * Mesma regra do banco:
 * - editar: quem criou, gerente ou acima, ou quem trata, aprova ou libera cargas
 *   (o banco ainda bloqueia mudar quantidades depois da liberação);
 * - excluir: admin ou acima, ou quem criou enquanto aguarda liberação, e só se a
 *   solicitação não teve movimento (nada liberado nem carregado).
 */
export function canEditDeleteCarregamento(
  carregamento: Pick<
    Carregamento,
    'status' | 'criado_por' | 'quantidade_liberada' | 'quantidade_carregada'
  >,
  currentUser: User
): { canEdit: boolean; canDelete: boolean } {
  const level = ROLE_LEVEL[currentUser.role] ?? 0;
  const permissions = (currentUser.permissions ?? {}) as Record<string, unknown>;
  const isOwner = !!carregamento.criado_por && carregamento.criado_por === currentUser.id;
  const isLoadingManager =
    level >= 60 ||
    [
      'carregamento_tratar_cotacao',
      'carregamento_aprovar_cotacao',
      'carregamento_liberar',
      'carregamento_admin',
    ].some((key) => permissions[key] === true);
  const semMovimento =
    !(Number(carregamento.quantidade_liberada) > 0) &&
    !(Number(carregamento.quantidade_carregada) > 0);
  return {
    canEdit: carregamento.status !== 'cancelado' && (isOwner || isLoadingManager),
    canDelete:
      semMovimento && (level >= 80 || (isOwner && carregamento.status === 'aguardando_liberacao')),
  };
}

// ─── Sub-view type ─────────────────────────────────────────────────────────────
export type CarregamentoView =
  | 'visao_geral'
  | 'solicitacao'
  | 'liberacao'
  | 'logistica'
  | 'calendario'
  | 'relatorios'
  | 'transportadoras';

export interface CarregamentoModuleProps {
  currentUser: User;
  view?: CarregamentoView;
}

// ─── Status labels & colors ─────────────────────────────────────────────────────
export const STATUS_LABEL: Record<StatusCarregamento, string> = {
  aguardando_cotacao: 'Aguardando Cotação',
  cotacao_solicitada: 'Cotação Solicitada',
  cotacao_recebida: 'Cotação Recebida',
  aguardando_liberacao: 'Aguardando Liberação',
  liberado_parcial: 'Liberado Parcial',
  liberado_total: 'Liberado Total',
  em_carregamento: 'Em Carregamento',
  carregado: 'Carregado',
  cancelado: 'Cancelado',
};

export const STATUS_COLOR: Record<StatusCarregamento, string> = {
  aguardando_cotacao: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  cotacao_solicitada: 'bg-blue-100 text-blue-800 border-blue-200',
  cotacao_recebida: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  aguardando_liberacao: 'bg-orange-100 text-orange-800 border-orange-200',
  liberado_parcial: 'bg-teal-100 text-teal-800 border-teal-200',
  liberado_total: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  em_carregamento: 'bg-purple-100 text-purple-800 border-purple-200',
  carregado: 'bg-green-100 text-green-800 border-green-200',
  cancelado: 'bg-red-100 text-red-800 border-red-200',
};

// ─── Helper: format currency ──────────────────────────────────────────────────
export function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function fmtDate(s?: string) {
  if (!s) return '—';
  return new Date(s + 'T00:00:00').toLocaleDateString('pt-BR');
}

export function fmtCarregamentoNum(c: { numero?: number; numero_carregamento: string }): string {
  return c.numero != null ? formatCarregamentoId(c.numero) : c.numero_carregamento || '—';
}

// ─── Badge component ───────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: StatusCarregamento }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLOR[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

// ─── Validade Cotação Badge ────────────────────────────────────────────────────
export function ValidadeCotacaoBadge({ validade }: { validade?: string }) {
  if (!validade) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const vencDate = new Date(validade + 'T00:00:00');
  const diffDays = Math.ceil((vencDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  let label: string;
  let className: string;
  if (diffDays < 0) {
    label = 'Vencida';
    className = 'bg-red-100 text-red-700 border border-red-200';
  } else if (diffDays === 0) {
    label = 'Vence hoje';
    className = 'bg-red-100 text-red-700 border border-red-200';
  } else if (diffDays <= 3) {
    label = `${diffDays}d restante${diffDays > 1 ? 's' : ''}`;
    className = 'bg-yellow-100 text-yellow-700 border border-yellow-200';
  } else {
    label = `${diffDays}d restantes`;
    className = 'bg-emerald-100 text-emerald-700 border border-emerald-200';
  }

  return (
    <span
      className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded ${className}`}
    >
      ⏱ {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MODAL: Novo Carregamento
// ─────────────────────────────────────────────────────────────────────────────

export interface EnrichedPedido {
  id: string | null;
  precificacao_id: string | null;
  numero_pedido?: string | null;
  barra_pedido?: string | null;
  quantidade_real?: number | null;
  tipo_frete?: string | null;
  valor_frete?: number | null;
  saldo_disponivel?: number | null;
  status?: PedidoVenda['status'];
  pricing?: PricingRecord;
  clientName?: string;
  _source: string;
}

export interface CarregamentoFormData {
  request_id?: string;
  tipo_frete: 'CIF' | 'FOB';
  quantidade_total: string;
  filial_id: string;
  local_carregamento_id: string;
  data_prevista_carregamento: string;
  observacoes: string;
  pedido_venda_id: string;
  pedido_venda_numero: string;
  precificacao_id: string;
  cliente_nome: string;
  valor_frete: string;
  _freteAutoDetectado: boolean;
  _freteOrigem?: 'pedido' | 'precificacao';
  itens?: {
    pedido_venda_item_id?: string;
    produto_nome: string;
    quantidade_ton: number;
    embalagem?: string;
  }[];
}

export interface CotacaoFormData {
  transportadora_id: string;
  valor_cotado: string;
  prazo_dias: string;
  validade_cotacao: string;
  observacoes: string;
}

export type ItemCarregamentoState = {
  item: PedidoVendaItem;
  selecionado: boolean;
  quantidade: string;
};

export type PedidoVendaItemComSaldo = PedidoVendaItem & { saldo_disponivel?: number };

export interface ModalNovoCarregamentoProps {
  filiais: Filial[];
  onSave: (data: CarregamentoFormData) => Promise<void>;
  onClose: () => void;
  pedidoVinculado?: PedidoVenda;
  carregamentoEditando?: Carregamento;
}

// Bug 2 fix — determina o tipo de frete em ordem de prioridade
export function derivarTipoFrete(pedido: EnrichedPedido, pricing?: PricingRecord): 'CIF' | 'FOB' {
  if (pedido?.tipo_frete === 'CIF' || pedido?.tipo_frete === 'FOB') {
    return pedido.tipo_frete as 'CIF' | 'FOB';
  }
  if (pricing?.factors?.tipoFrete === 'CIF' || pricing?.factors?.tipoFrete === 'FOB') {
    return pricing.factors.tipoFrete;
  }
  if (pricing?.factors?.freight != null && Number(pricing.factors.freight) > 0) {
    return 'CIF';
  }
  return 'FOB';
}
