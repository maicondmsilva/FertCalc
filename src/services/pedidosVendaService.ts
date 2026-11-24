import { supabase } from './supabase';
import { PedidoVenda, PedidoVendaItem, CancelamentoPedido } from '../types';

export interface PedidoSaldoAlertaPreferencia {
  dias_limite: number;
  desativado: boolean;
}

export interface PedidoVendaAuditEntry {
  id: string;
  pedido_venda_id: string;
  usuario_id: string;
  motivo: string;
  campos_alterados: string[];
  criado_em: string;
}

export interface UpdatePedidoVendaProtegidoPayload {
  pedidoId: string;
  expectedUpdatedAt?: string;
  reason: string;
  force?: boolean;
  header: {
    numero_pedido: string;
    emitente: number;
    data_pedido?: string;
    data_vencimento?: string;
    cliente_id?: string;
    precificacao_id?: string;
    filial_id?: string;
    tipo_frete?: string;
    valor_frete?: number;
    preco_unitario?: number;
    condicao_pagamento?: string;
    observacoes?: string;
  };
  items: PedidoVendaItem[];
}

export interface PedidoVendaEditContext {
  hasRequest: boolean;
  hasProgress: boolean;
}

/** Computes saldo_disponivel: prefers the DB-generated column, falls back to manual calculation. */
function computeSaldoDisponivel(d: Record<string, unknown>): number | undefined {
  if (d.saldo_disponivel != null) return Number(d.saldo_disponivel);
  const original =
    d.quantidade_original != null
      ? Number(d.quantidade_original)
      : d.quantidade_real != null
        ? Number(d.quantidade_real)
        : null;
  if (original != null) {
    const desmembrada = d.quantidade_desmembrada != null ? Number(d.quantidade_desmembrada) : 0;
    const cancelada =
      d.quantidade_cancelada_definitiva != null ? Number(d.quantidade_cancelada_definitiva) : 0;
    return original - desmembrada - cancelada;
  }
  return undefined;
}

function mapPedido(d: Record<string, unknown>): PedidoVenda {
  return {
    id: d.id as string,
    organization_id: d.organization_id as string,
    precificacao_id: d.precificacao_id as string,
    numero_pedido: d.numero_pedido as string | undefined,
    barra_pedido: d.barra_pedido as string | undefined,
    data_pedido: d.data_pedido as string | undefined,
    quantidade_real: d.quantidade_real != null ? Number(d.quantidade_real) : undefined,
    embalagem: d.embalagem as string | undefined,
    valor_unitario_negociado:
      d.valor_unitario_negociado != null ? Number(d.valor_unitario_negociado) : undefined,
    valor_total_negociado:
      d.valor_total_negociado != null ? Number(d.valor_total_negociado) : undefined,
    tipo_frete: d.tipo_frete as string | undefined,
    valor_frete: d.valor_frete != null ? Number(d.valor_frete) : undefined,
    status: (d.status ?? 'pendente') as PedidoVenda['status'],
    status_pedido: (d.status_pedido as string | undefined) ?? 'ativo',
    pdf_url: d.pdf_url as string | undefined,
    dados_extraidos: d.dados_extraidos as Record<string, unknown> | undefined,
    importado_por: d.importado_por as string | undefined,
    criado_em: d.criado_em as string | undefined,
    atualizado_em: d.atualizado_em as string | undefined,
    // Extended fields
    cliente_id: d.cliente_id as string | undefined,
    cliente_nome: d.cliente_nome as string | undefined,
    cliente_ie: d.cliente_ie as string | undefined,
    cliente_fazenda: d.cliente_fazenda as string | undefined,
    produto_nome: d.produto_nome as string | undefined,
    quantidade_carregada:
      d.quantidade_carregada != null ? Number(d.quantidade_carregada) : undefined,
    quantidade_reservada:
      d.quantidade_reservada != null ? Number(d.quantidade_reservada) : undefined,
    quantidade_original: d.quantidade_original != null ? Number(d.quantidade_original) : undefined,
    quantidade_desmembrada: d.quantidade_desmembrada != null ? Number(d.quantidade_desmembrada) : 0,
    quantidade_cancelada_definitiva:
      d.quantidade_cancelada_definitiva != null ? Number(d.quantidade_cancelada_definitiva) : 0,
    saldo_disponivel: computeSaldoDisponivel(d),
    saldo_a_carregar: d.saldo_a_carregar != null ? Number(d.saldo_a_carregar) : undefined,
    preco_unitario: d.preco_unitario != null ? Number(d.preco_unitario) : undefined,
    condicao_pagamento: d.condicao_pagamento as string | undefined,
    observacoes: d.observacoes as string | undefined,
    filial_id: d.filial_id as string | undefined,
    formulacao_alterada: d.formulacao_alterada as boolean | undefined,
    pedido_pai_id: d.pedido_pai_id as string | undefined,
    data_vencimento: d.data_vencimento as string | undefined,
    emitente: d.emitente != null ? Number(d.emitente) : 1,
    safra: (d.safra as string | null) ?? undefined,
    previsao_entrega: (d.previsao_entrega as string | null) ?? undefined,
    local_entrega: (d.local_entrega as string | null) ?? undefined,
    numero_contrato: (d.numero_contrato as string | null) ?? undefined,
    vendedor_nome: (d.vendedor_nome as string | null) ?? undefined,
    ultima_movimentacao: (d.ultima_movimentacao as string | null) ?? undefined,
  };
}

export async function getPedidoSaldoAlertaPreferencia(
  pedidoVendaId: string,
  userId: string
): Promise<PedidoSaldoAlertaPreferencia> {
  const { data, error } = await supabase
    .from('pedido_saldo_alerta_preferencias')
    .select('dias_limite, desativado')
    .eq('pedido_venda_id', pedidoVendaId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data
    ? { dias_limite: Number(data.dias_limite), desativado: Boolean(data.desativado) }
    : { dias_limite: 30, desativado: false };
}

export async function savePedidoSaldoAlertaPreferencia(
  pedidoVendaId: string,
  userId: string,
  preferencia: PedidoSaldoAlertaPreferencia
): Promise<void> {
  const { error } = await supabase.from('pedido_saldo_alerta_preferencias').upsert(
    {
      pedido_venda_id: pedidoVendaId,
      user_id: userId,
      dias_limite: preferencia.dias_limite,
      desativado: preferencia.desativado,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'pedido_venda_id,user_id' }
  );
  if (error) throw error;
}

export async function getPedidosVenda(filtros?: {
  clienteNome?: string;
  status?: string;
  filialId?: string;
}): Promise<PedidoVenda[]> {
  let query = supabase.from('pedidos_venda').select('*').order('criado_em', { ascending: false });

  if (filtros?.clienteNome) {
    query = query.ilike('cliente_nome', `%${filtros.clienteNome}%`);
  }
  if (filtros?.status) {
    query = query.eq('status', filtros.status);
  }
  if (filtros?.filialId) {
    query = query.eq('filial_id', filtros.filialId);
  }

  const { data, error } = await query;
  if (error) throw error;
  if (!data) throw new Error('A consulta de pedidos nao retornou dados.');
  return data.map(mapPedido);
}

export interface PedidosVendaPageFilters {
  busca?: string;
  status?: string;
  filialId?: string;
}

export interface PedidosVendaPage {
  data: PedidoVenda[];
  total: number;
}

export async function getPedidosVendaPage(
  filtros: PedidosVendaPageFilters = {},
  page = 1,
  pageSize = 25
): Promise<PedidosVendaPage> {
  const { data, error } = await supabase.rpc('buscar_pedidos_venda_paginados', {
    p_busca: filtros.busca?.trim() || null,
    p_status: filtros.status || null,
    p_filial_id: filtros.filialId || null,
    p_offset: Math.max(0, page - 1) * pageSize,
    p_limit: pageSize,
  });
  if (error) throw error;

  const rows = (data ?? []) as Array<{ pedido: Record<string, unknown>; total_registros: number }>;
  return {
    total: rows[0] ? Number(rows[0].total_registros) : 0,
    data: rows.map((row) => mapPedido(row.pedido)),
  };
}

export interface CarteiraPedidosFilters {
  busca?: string;
  status?: string;
  filialId?: string;
  safra?: string;
}

/** Carteira de pedidos: mais recentes primeiro, com cliente, vendedor e última movimentação. */
export async function getCarteiraPedidos(
  filtros: CarteiraPedidosFilters = {},
  page = 1,
  pageSize = 25
): Promise<PedidosVendaPage> {
  const { data, error } = await supabase.rpc('buscar_carteira_pedidos_venda', {
    p_busca: filtros.busca?.trim() || null,
    p_status: filtros.status || null,
    p_filial_id: filtros.filialId || null,
    p_safra: filtros.safra || null,
    p_offset: Math.max(0, page - 1) * pageSize,
    p_limit: pageSize,
  });
  if (error) throw error;
  const rows = (data ?? []) as Array<{ pedido: Record<string, unknown>; total_registros: number }>;
  return {
    total: rows[0] ? Number(rows[0].total_registros) : 0,
    data: rows.map((row) => mapPedido(row.pedido)),
  };
}

export interface ResumoCarteira {
  ativos: number;
  emCarregamento: number;
  concluidos: number;
  cancelados: number;
  volumeAtivo: number;
  saldoACarregar: number;
  carregado: number;
  parados: number;
  safras: string[];
}

export async function getResumoCarteira(
  filtros: Pick<CarteiraPedidosFilters, 'filialId' | 'safra'> = {},
  diasParado = 30
): Promise<ResumoCarteira> {
  const { data, error } = await supabase.rpc('resumo_carteira_pedidos_venda', {
    p_filial_id: filtros.filialId || null,
    p_safra: filtros.safra || null,
    p_dias_parado: diasParado,
  });
  if (error) throw error;
  const d = (data ?? {}) as Record<string, unknown>;
  const num = (value: unknown) => Number(value) || 0;
  return {
    ativos: num(d.ativos),
    emCarregamento: num(d.em_carregamento),
    concluidos: num(d.concluidos),
    cancelados: num(d.cancelados),
    volumeAtivo: num(d.volume_ativo),
    saldoACarregar: num(d.saldo_a_carregar),
    carregado: num(d.carregado),
    parados: num(d.parados),
    safras: Array.isArray(d.safras) ? (d.safras as string[]) : [],
  };
}

export interface DadosComerciaisPedido {
  safra?: string;
  previsao_entrega?: string;
  local_entrega?: string;
  numero_contrato?: string;
}

/** Atualiza safra, previsão e local de entrega e contrato (registrado no histórico). */
export async function updateDadosComerciaisPedido(
  pedidoId: string,
  dados: DadosComerciaisPedido
): Promise<void> {
  const { error } = await supabase.rpc('atualizar_dados_comerciais_pedido', {
    p_pedido_id: pedidoId,
    p_safra: dados.safra?.trim() || null,
    p_previsao_entrega: dados.previsao_entrega || null,
    p_local_entrega: dados.local_entrega?.trim() || null,
    p_numero_contrato: dados.numero_contrato?.trim() || null,
  });
  if (error) throw error;
}

export async function getPedidoVendaById(id: string): Promise<PedidoVenda | null> {
  const { data, error } = await supabase
    .from('pedidos_venda')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapPedido(data) : null;
}

export async function getPedidoVendaByPrecificacao(
  precificacaoId: string
): Promise<PedidoVenda | null> {
  const { data, error } = await supabase
    .from('pedidos_venda')
    .select('*')
    .eq('precificacao_id', precificacaoId)
    .maybeSingle();
  if (error || !data) return null;
  return mapPedido(data);
}

export async function checkPedidoDuplicado(
  numeroPedido: string,
  emitente: number
): Promise<boolean> {
  const numero = numeroPedido.trim();
  if (!numero || !emitente || emitente < 1) return false;

  const { data, error } = await supabase
    .from('pedidos_venda')
    .select('id')
    .eq('numero_pedido', numero)
    .eq('emitente', emitente)
    .limit(1);

  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function getEmitentesUsados(numeroPedido: string): Promise<number[]> {
  const numero = numeroPedido.trim();
  if (!numero) return [];

  const { data, error } = await supabase
    .from('pedidos_venda')
    .select('emitente')
    .eq('numero_pedido', numero);

  if (error) throw error;

  const rows = (data ?? []) as Array<{ emitente: number | string | null }>;
  const usados = new Set<number>();
  for (const row of rows) {
    const emitente = Number(row.emitente);
    if (!Number.isNaN(emitente) && emitente >= 1) usados.add(emitente);
  }

  return Array.from(usados).sort((a, b) => a - b);
}

export type NovoPedidoVendaItem = Omit<
  PedidoVendaItem,
  | 'id'
  | 'organization_id'
  | 'pedido_venda_id'
  | 'criado_em'
  | 'quantidade_reservada'
  | 'quantidade_carregada'
  | 'saldo_disponivel'
  | 'saldo_a_carregar'
>;

/**
 * Cria o pedido e os produtos numa única transação no banco (criar_pedido_venda).
 * O banco define dono, status e saldos; quantidades e cancelamentos não vêm da tela.
 */
export async function createPedidoVenda(
  pedido: Omit<PedidoVenda, 'id' | 'criado_em' | 'atualizado_em' | 'status'> & {
    status?: PedidoVenda['status'];
  },
  itens: NovoPedidoVendaItem[]
): Promise<PedidoVenda> {
  if (itens.length === 0) {
    throw new Error('Informe ao menos um produto no pedido.');
  }
  const { data: pedidoId, error } = await supabase.rpc('criar_pedido_venda', {
    p_pedido: {
      precificacao_id: pedido.precificacao_id || null,
      numero_pedido: pedido.numero_pedido ?? null,
      barra_pedido: pedido.barra_pedido ?? null,
      emitente: pedido.emitente ?? 1,
      data_pedido: pedido.data_pedido ?? null,
      data_vencimento: pedido.data_vencimento ?? null,
      embalagem: pedido.embalagem ?? null,
      valor_unitario_negociado: pedido.valor_unitario_negociado ?? null,
      valor_total_negociado: pedido.valor_total_negociado ?? null,
      tipo_frete: pedido.tipo_frete ?? null,
      valor_frete: pedido.valor_frete ?? null,
      pdf_url: pedido.pdf_url ?? null,
      dados_extraidos: pedido.dados_extraidos ?? null,
      cliente_id: pedido.cliente_id ?? null,
      preco_unitario: pedido.preco_unitario ?? null,
      condicao_pagamento: pedido.condicao_pagamento ?? null,
      observacoes: pedido.observacoes ?? null,
      filial_id: pedido.filial_id ?? null,
      formulacao_alterada: pedido.formulacao_alterada ?? false,
      safra: pedido.safra ?? null,
      previsao_entrega: pedido.previsao_entrega ?? null,
      local_entrega: pedido.local_entrega ?? null,
      numero_contrato: pedido.numero_contrato ?? null,
    },
    p_itens: itens.map((item) => ({
      produto_nome: item.produto_nome,
      formulacao: item.formulacao ?? null,
      quantidade_ton: item.quantidade_ton,
      preco_unitario: item.preco_unitario ?? null,
      embalagem: item.embalagem ?? null,
      precificacao_id: item.precificacao_id ?? null,
    })),
  });
  if (error) {
    const errorCode =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code)
        : undefined;
    if (errorCode === '23505') {
      throw new Error('Pedido duplicado: já existe um pedido com esse número e emitente.');
    }
    throw error;
  }
  if (!pedidoId) throw new Error('O pedido não foi criado.');

  const criado = await getPedidoVendaById(String(pedidoId));
  if (!criado) throw new Error('O pedido foi criado, mas não pôde ser carregado.');
  return criado;
}

export async function updatePedidoVendaProtegido(
  payload: UpdatePedidoVendaProtegidoPayload
): Promise<void> {
  const { error } = await supabase.rpc('update_pedido_venda_protegido', {
    p_pedido_id: payload.pedidoId,
    p_expected_updated_at: payload.expectedUpdatedAt ?? null,
    p_reason: payload.reason,
    p_header: payload.header,
    p_items: payload.items.map((item) => ({
      id: item.id ?? null,
      produto_nome: item.produto_nome,
      quantidade_ton: item.quantidade_ton,
      preco_unitario: item.preco_unitario ?? null,
      embalagem: item.embalagem ?? null,
      precificacao_id: item.precificacao_id ?? null,
    })),
    p_force: payload.force ?? false,
  });
  if (error) throw error;
}

export async function getPedidoVendaAudit(pedidoVendaId: string): Promise<PedidoVendaAuditEntry[]> {
  const { data, error } = await supabase
    .from('pedido_venda_audit')
    .select('id,pedido_venda_id,usuario_id,motivo,campos_alterados,criado_em')
    .eq('pedido_venda_id', pedidoVendaId)
    .order('criado_em', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PedidoVendaAuditEntry[];
}

export async function getPedidoVendaEditContext(
  pedidoVendaId: string
): Promise<PedidoVendaEditContext> {
  const { data, error } = await supabase.rpc('get_pedido_venda_edit_context', {
    p_pedido_id: pedidoVendaId,
  });
  if (error) throw error;
  return data as unknown as PedidoVendaEditContext;
}

// Search pedidos for linking to carregamento
export async function searchPedidosVenda(query: string): Promise<PedidoVenda[]> {
  if (!query || query.trim().length < 2) return [];
  const { data, error } = await supabase
    .from('pedidos_venda')
    .select('*')
    .or(`numero_pedido.ilike.%${query}%,barra_pedido.ilike.%${query}%`)
    .order('criado_em', { ascending: false })
    .limit(20);
  if (error || !data) return [];
  return data.map(mapPedido);
}

export async function getPedidosPendentes(filialIds?: string[]): Promise<PedidoVenda[]> {
  let query = supabase
    .from('pedidos_venda')
    .select('*')
    .eq('status', 'pendente')
    .gt('saldo_disponivel', 0)
    .order('criado_em', { ascending: false });

  if (filialIds && filialIds.length > 0) {
    query = query.in('filial_id', filialIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapPedido);
}

export async function getPedidoVendaItens(pedidoVendaId: string): Promise<PedidoVendaItem[]> {
  const { data, error } = await supabase
    .from('pedidos_venda_itens')
    .select('*')
    .eq('pedido_venda_id', pedidoVendaId)
    .order('criado_em', { ascending: true });
  if (error) throw error;
  if (!data) throw new Error('A consulta de itens do pedido nao retornou dados.');
  return (data as Record<string, unknown>[]).map((d) => ({
    id: d.id as string,
    pedido_venda_id: d.pedido_venda_id as string,
    produto_nome: d.produto_nome as string,
    formulacao: d.formulacao as string | undefined,
    quantidade_ton: Number(d.quantidade_ton),
    quantidade_reservada:
      d.quantidade_reservada != null ? Number(d.quantidade_reservada) : undefined,
    quantidade_carregada:
      d.quantidade_carregada != null ? Number(d.quantidade_carregada) : undefined,
    saldo_disponivel: d.saldo_disponivel != null ? Number(d.saldo_disponivel) : undefined,
    saldo_a_carregar: d.saldo_a_carregar != null ? Number(d.saldo_a_carregar) : undefined,
    preco_unitario: d.preco_unitario != null ? Number(d.preco_unitario) : undefined,
    embalagem: d.embalagem as string | undefined,
    precificacao_id: d.precificacao_id as string | undefined,
    criado_em: d.criado_em as string,
  }));
}

// ---------------------------------------------------------------------------
// Cancelamentos
// ---------------------------------------------------------------------------

function mapCancelamento(d: Record<string, unknown>): CancelamentoPedido {
  return {
    id: d.id as string,
    pedido_origem_id: d.pedido_origem_id as string,
    pedido_destino_id: d.pedido_destino_id as string | undefined,
    tipo: d.tipo as 'canc_substitui' | 'definitivo',
    quantidade: Number(d.quantidade),
    motivo: d.motivo as string | undefined,
    usuario_id: d.usuario_id as string | undefined,
    usuario_nome: d.usuario_nome as string | undefined,
    criado_em: d.criado_em as string,
  };
}

export interface GetCancelamentosFilters {
  pedidoOrigemId?: string;
  tipo?: 'canc_substitui' | 'definitivo';
  dataInicio?: string;
  dataFim?: string;
  numeroPedido?: string;
  clienteNome?: string;
  usuarioNome?: string;
}

export interface CancelamentoRelatorioRow extends CancelamentoPedido {
  pedidoOrigemNome?: string;
  pedidoOrigemCliente?: string;
  pedidoOrigemIe?: string;
  pedidoOrigemFazenda?: string;
  pedidoOrigemProduto?: string;
  pedidoOrigemQtd?: number;
  pedidoOrigemDisponivel: boolean;
  pedidoDestinoNome?: string;
  pedidoDestinoCliente?: string;
  pedidoDestinoIe?: string;
  pedidoDestinoDisponivel: boolean;
  pedidoSaldoRestante?: number;
}

export interface SaldosCanceladosFilters {
  busca?: string;
  dataInicio?: string;
  dataFim?: string;
}

export async function getSaldosCancelados(
  filters: SaldosCanceladosFilters,
  page = 1,
  pageSize = 20
): Promise<CancelamentoRelatorioResult> {
  const { data, error } = await supabase.rpc('buscar_saldos_cancelados', {
    p_busca: filters.busca?.trim() || null,
    p_data_inicio: filters.dataInicio || null,
    p_data_fim: filters.dataFim || null,
    p_offset: Math.max(0, page - 1) * pageSize,
    p_limit: pageSize,
  });
  if (error) throw error;

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const first = rows[0];
  return {
    total: first ? Number(first.total_registros) : 0,
    totalQuantidade: first ? Number(first.total_quantidade) : 0,
    totalDefinitivos: first ? Number(first.total_registros) : 0,
    data: rows.map((row) => ({
      ...mapCancelamento(row),
      pedidoOrigemNome: row.pedido_origem_nome as string | undefined,
      pedidoOrigemCliente: row.pedido_origem_cliente as string | undefined,
      pedidoOrigemIe: row.pedido_origem_ie as string | undefined,
      pedidoOrigemFazenda: row.pedido_origem_fazenda as string | undefined,
      pedidoOrigemProduto: row.pedido_origem_produto as string | undefined,
      pedidoOrigemQtd:
        row.pedido_origem_quantidade != null ? Number(row.pedido_origem_quantidade) : undefined,
      pedidoOrigemDisponivel: Boolean(row.pedido_origem_disponivel),
      pedidoDestinoDisponivel: false,
      pedidoSaldoRestante:
        row.pedido_origem_saldo != null ? Number(row.pedido_origem_saldo) : undefined,
    })),
  };
}

export interface CancelamentoRelatorioFilters extends GetCancelamentosFilters {
  emitenteOrigem?: number;
  emitenteDestino?: number;
}

export interface CancelamentoRelatorioResult {
  data: CancelamentoRelatorioRow[];
  total: number;
  totalQuantidade: number;
  totalDefinitivos: number;
}

export async function getCancelamentosRelatorio(
  filters: CancelamentoRelatorioFilters,
  page = 1,
  pageSize = 20
): Promise<CancelamentoRelatorioResult> {
  const { data, error } = await supabase.rpc('buscar_cancelamentos_pedido_relatorio', {
    p_tipo: filters.tipo ?? null,
    p_data_inicio: filters.dataInicio ?? null,
    p_data_fim: filters.dataFim ?? null,
    p_numero_pedido: filters.numeroPedido?.trim() || null,
    p_cliente_nome: filters.clienteNome?.trim() || null,
    p_usuario_nome: filters.usuarioNome?.trim() || null,
    p_emitente_origem: filters.emitenteOrigem ?? null,
    p_emitente_destino: filters.emitenteDestino ?? null,
    p_offset: Math.max(0, page - 1) * pageSize,
    p_limit: pageSize,
  });
  if (error) throw error;

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const first = rows[0];
  return {
    total: first ? Number(first.total_registros) : 0,
    totalQuantidade: first ? Number(first.total_quantidade) : 0,
    totalDefinitivos: first ? Number(first.total_definitivos) : 0,
    data: rows.map((row) => ({
      ...mapCancelamento(row),
      pedidoOrigemNome: row.pedido_origem_nome as string | undefined,
      pedidoOrigemCliente: row.pedido_origem_cliente as string | undefined,
      pedidoOrigemIe: row.pedido_origem_ie as string | undefined,
      pedidoOrigemProduto: row.pedido_origem_produto as string | undefined,
      pedidoOrigemQtd:
        row.pedido_origem_quantidade != null ? Number(row.pedido_origem_quantidade) : undefined,
      pedidoOrigemDisponivel: true,
      pedidoDestinoNome: row.pedido_destino_nome as string | undefined,
      pedidoDestinoCliente: row.pedido_destino_cliente as string | undefined,
      pedidoDestinoIe: row.pedido_destino_ie as string | undefined,
      pedidoDestinoDisponivel: Boolean(row.pedido_destino_disponivel),
      pedidoSaldoRestante:
        row.pedido_origem_saldo != null ? Number(row.pedido_origem_saldo) : undefined,
    })),
  };
}

export async function getCancelamentos(
  filters?: GetCancelamentosFilters
): Promise<CancelamentoPedido[]> {
  let query = supabase
    .from('cancelamentos_pedido')
    .select('*')
    .order('criado_em', { ascending: false });

  if (filters?.pedidoOrigemId) {
    query = query.eq('pedido_origem_id', filters.pedidoOrigemId);
  }
  if (filters?.tipo) {
    query = query.eq('tipo', filters.tipo);
  }
  if (filters?.dataInicio) {
    query = query.gte('criado_em', filters.dataInicio);
  }
  if (filters?.dataFim) {
    query = query.lte('criado_em', filters.dataFim + 'T23:59:59');
  }
  if (filters?.usuarioNome) {
    query = query.ilike('usuario_nome', `%${filters.usuarioNome}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  if (!data) throw new Error('A consulta de cancelamentos nao retornou dados.');
  return (data as Record<string, unknown>[]).map(mapCancelamento);
}

export interface CancelamentosStats {
  totalOperacoes: number;
  totalQtdDesmembrada: number;
  totalCancelamentosDefinitivos: number;
}

export async function getCancelamentosStats(
  filters?: GetCancelamentosFilters
): Promise<CancelamentosStats> {
  const all = await getCancelamentos(filters);
  return {
    totalOperacoes: all.length,
    totalQtdDesmembrada: all.reduce((sum, c) => sum + c.quantidade, 0),
    totalCancelamentosDefinitivos: all.filter((c) => c.tipo === 'definitivo').length,
  };
}

/**
 * Execute Canc/Substitui:
 * 1. Create child pedido
 * 2. Log cancelamento
 * 3. Update parent's quantidade_desmembrada
 */
export interface CancSubstituiPayload {
  pedidoPai: PedidoVenda;
  filho: Omit<PedidoVenda, 'id' | 'criado_em' | 'atualizado_em'>;
  motivo: string;
  usuarioId: string;
  usuarioNome: string;
}

export async function executarCancSubstitui(payload: CancSubstituiPayload): Promise<PedidoVenda> {
  const { pedidoPai, filho, motivo } = payload;
  const qtdFilho = filho.quantidade_real ?? 0;

  // Validate saldo
  const saldoPai =
    pedidoPai.saldo_disponivel ??
    (pedidoPai.quantidade_original ?? pedidoPai.quantidade_real ?? 0) -
      (pedidoPai.quantidade_desmembrada ?? 0) -
      (pedidoPai.quantidade_cancelada_definitiva ?? 0);

  if (qtdFilho > saldoPai) {
    throw new Error('Quantidade desmembrada maior que o saldo disponível.');
  }

  // O banco valida o saldo novamente sob bloqueio e executa pedido filho,
  // item, baixa do pedido origem e historico na mesma transacao.
  const { data: pedidoFilhoId, error } = await supabase.rpc('executar_pedido_canc_substitui', {
    p_pedido_origem_id: pedidoPai.id,
    p_quantidade: qtdFilho,
    p_produto_nome: filho.produto_nome,
    p_motivo: motivo,
    p_filho: filho,
  });
  if (error) throw error;
  if (!pedidoFilhoId) throw new Error('O pedido destino nao foi criado.');

  const { data: pedidoFilho, error: pedidoError } = await supabase
    .from('pedidos_venda')
    .select('*')
    .eq('id', pedidoFilhoId)
    .single();
  if (pedidoError) throw pedidoError;
  return mapPedido(pedidoFilho);
}

/**
 * Execute Cancelamento Definitivo (total or partial)
 */
export interface CancelamentoDefinitivoPayload {
  pedido: PedidoVenda;
  quantidade?: number; // undefined = total
  motivo: string;
  usuarioId: string;
  usuarioNome: string;
}

export async function executarCancelamentoDefinitivo(
  payload: CancelamentoDefinitivoPayload
): Promise<void> {
  const { pedido, motivo } = payload;
  const saldo =
    pedido.saldo_disponivel ??
    (pedido.quantidade_original ?? pedido.quantidade_real ?? 0) -
      (pedido.quantidade_desmembrada ?? 0) -
      (pedido.quantidade_cancelada_definitiva ?? 0);

  const isTotal = payload.quantidade == null;
  const qtdCancelar = isTotal ? saldo : payload.quantidade!;

  if (qtdCancelar <= 0) {
    throw new Error('Quantidade a cancelar deve ser maior que zero.');
  }
  if (qtdCancelar > saldo) {
    throw new Error('Quantidade a cancelar maior que o saldo disponível.');
  }

  const { error } = await supabase.rpc('executar_pedido_cancelamento_definitivo', {
    p_pedido_id: pedido.id,
    p_quantidade: isTotal ? null : qtdCancelar,
    p_motivo: motivo,
  });
  if (error) throw error;
}

/**
 * Sincroniza síncronamente o status e quantidade carregada do pedido com base nos carregamentos associados.
 */
export async function syncPedidoVendaStatus(pedidoVendaId: string): Promise<void> {
  const { error } = await supabase.rpc('recalcular_pedido_venda', {
    p_pedido_id: pedidoVendaId,
  });
  if (error) throw error;
}
