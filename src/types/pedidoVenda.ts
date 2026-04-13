// ─────────────────────────────────────────────────────────────
//  Pedidos de Venda — type definitions
// ─────────────────────────────────────────────────────────────

export type StatusPedidoVenda = 'pendente' | 'em_carregamento' | 'concluido' | 'cancelado';

export interface PedidoVenda {
  id: string;
  precificacao_id: string;
  numero_pedido?: string;
  barra_pedido?: string;
  data_pedido?: string;
  quantidade_real?: number;
  valor_unitario_negociado?: number;
  valor_total_negociado?: number;
  embalagem?: string;
  tipo_frete?: string;
  valor_frete?: number;
  status: StatusPedidoVenda;
  pdf_url?: string;
  dados_extraidos?: Record<string, unknown>;
  importado_por?: string;
  criado_em: string;
  atualizado_em: string;
}

/** Enriched pedido with joined pricing data for display */
export interface PedidoVendaEnriquecido extends PedidoVenda {
  cliente_nome?: string;
  vendedor_nome?: string;
  vendedor_id?: string;
  formulacao?: string;
  precificacao_cod?: string;
}

/** Data extracted from imported PDF */
export interface DadosExtraidosPDF {
  numero_pedido?: string;
  barra_pedido?: string;
  data_pedido?: string;
  quantidade_real?: number;
  valor_unitario?: number;
  valor_total?: number;
  embalagem?: string;
  tipo_frete?: string;
  valor_frete?: number;
}
