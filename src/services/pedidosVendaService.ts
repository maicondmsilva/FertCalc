import { supabase } from './supabase';
import { PedidoVenda, PedidoVendaItem, CancelamentoPedido } from '../types';

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
    produto_nome: d.produto_nome as string | undefined,
    quantidade_carregada:
      d.quantidade_carregada != null ? Number(d.quantidade_carregada) : undefined,
    quantidade_original: d.quantidade_original != null ? Number(d.quantidade_original) : undefined,
    quantidade_desmembrada: d.quantidade_desmembrada != null ? Number(d.quantidade_desmembrada) : 0,
    quantidade_cancelada_definitiva:
      d.quantidade_cancelada_definitiva != null ? Number(d.quantidade_cancelada_definitiva) : 0,
    saldo_disponivel: computeSaldoDisponivel(d),
    preco_unitario: d.preco_unitario != null ? Number(d.preco_unitario) : undefined,
    condicao_pagamento: d.condicao_pagamento as string | undefined,
    observacoes: d.observacoes as string | undefined,
    filial_id: d.filial_id as string | undefined,
    formulacao_alterada: d.formulacao_alterada as boolean | undefined,
    pedido_pai_id: d.pedido_pai_id as string | undefined,
    data_vencimento: d.data_vencimento as string | undefined,
    emitente: d.emitente != null ? Number(d.emitente) : 1,
  };
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
  if (error || !data) return [];
  return data.map(mapPedido);
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

export async function createPedidoVenda(
  pedido: Omit<PedidoVenda, 'id' | 'criado_em' | 'atualizado_em'>
): Promise<PedidoVenda> {
  const { data, error } = await supabase
    .from('pedidos_venda')
    .insert({
      precificacao_id: pedido.precificacao_id || null,
      numero_pedido: pedido.numero_pedido,
      barra_pedido: pedido.barra_pedido,
      data_pedido: pedido.data_pedido,
      data_vencimento: pedido.data_vencimento ?? null,
      quantidade_real: pedido.quantidade_real,
      quantidade_original: pedido.quantidade_original ?? pedido.quantidade_real,
      quantidade_desmembrada: pedido.quantidade_desmembrada ?? 0,
      quantidade_cancelada_definitiva: pedido.quantidade_cancelada_definitiva ?? 0,
      embalagem: pedido.embalagem,
      valor_unitario_negociado: pedido.valor_unitario_negociado,
      valor_total_negociado: pedido.valor_total_negociado,
      tipo_frete: pedido.tipo_frete,
      valor_frete: pedido.valor_frete,
      status: pedido.status ?? 'pendente',
      status_pedido: pedido.status_pedido ?? 'ativo',
      pdf_url: pedido.pdf_url,
      dados_extraidos: pedido.dados_extraidos,
      importado_por: pedido.importado_por,
      // Extended fields
      cliente_id: pedido.cliente_id,
      cliente_nome: pedido.cliente_nome,
      produto_nome: pedido.produto_nome,
      preco_unitario: pedido.preco_unitario,
      condicao_pagamento: pedido.condicao_pagamento,
      observacoes: pedido.observacoes,
      filial_id: pedido.filial_id,
      formulacao_alterada: pedido.formulacao_alterada,
      pedido_pai_id: pedido.pedido_pai_id,
      emitente: pedido.emitente ?? 1,
    })
    .select()
    .single();
  if (error) throw error;
  return mapPedido(data);
}

export async function updatePedidoVenda(id: string, updates: Partial<PedidoVenda>): Promise<void> {
  const { error } = await supabase
    .from('pedidos_venda')
    .update({
      numero_pedido: updates.numero_pedido,
      barra_pedido: updates.barra_pedido,
      data_pedido: updates.data_pedido,
      quantidade_real: updates.quantidade_real,
      quantidade_original: updates.quantidade_original,
      quantidade_desmembrada: updates.quantidade_desmembrada,
      quantidade_cancelada_definitiva: updates.quantidade_cancelada_definitiva,
      embalagem: updates.embalagem,
      valor_unitario_negociado: updates.valor_unitario_negociado,
      valor_total_negociado: updates.valor_total_negociado,
      tipo_frete: updates.tipo_frete,
      valor_frete: updates.valor_frete,
      status: updates.status,
      status_pedido: updates.status_pedido,
      pdf_url: updates.pdf_url,
      dados_extraidos: updates.dados_extraidos,
      // Extended fields
      cliente_id: updates.cliente_id,
      cliente_nome: updates.cliente_nome,
      produto_nome: updates.produto_nome,
      preco_unitario: updates.preco_unitario,
      condicao_pagamento: updates.condicao_pagamento,
      observacoes: updates.observacoes,
      filial_id: updates.filial_id,
      formulacao_alterada: updates.formulacao_alterada,
      atualizado_em: new Date().toISOString(),
      emitente: updates.emitente,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function cancelarPedidoVenda(id: string): Promise<void> {
  return updatePedidoVenda(id, { status: 'cancelado' });
}

export async function deletePedidoVenda(id: string): Promise<void> {
  const { error } = await supabase.from('pedidos_venda').delete().eq('id', id);
  if (error) throw error;
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

export async function createPedidoVendaItens(
  pedidoVendaId: string,
  itens: Omit<PedidoVendaItem, 'id' | 'pedido_venda_id' | 'criado_em'>[]
): Promise<void> {
  if (!itens || itens.length === 0) return;
  const rows = itens.map((item) => ({
    pedido_venda_id: pedidoVendaId,
    produto_nome: item.produto_nome,
    formulacao: item.formulacao ?? null,
    quantidade_ton: item.quantidade_ton,
    preco_unitario: item.preco_unitario ?? null,
    precificacao_id: item.precificacao_id ?? null,
  }));
  const { error } = await supabase.from('pedidos_venda_itens').insert(rows);
  if (error) throw error;
}

export async function getPedidoVendaItens(pedidoVendaId: string): Promise<PedidoVendaItem[]> {
  const { data, error } = await supabase
    .from('pedidos_venda_itens')
    .select('*')
    .eq('pedido_venda_id', pedidoVendaId)
    .order('criado_em', { ascending: true });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((d) => ({
    id: d.id as string,
    pedido_venda_id: d.pedido_venda_id as string,
    produto_nome: d.produto_nome as string,
    formulacao: d.formulacao as string | undefined,
    quantidade_ton: Number(d.quantidade_ton),
    preco_unitario: d.preco_unitario != null ? Number(d.preco_unitario) : undefined,
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

export interface CreateCancelamentoPayload {
  pedido_origem_id: string;
  pedido_destino_id?: string;
  tipo: 'canc_substitui' | 'definitivo';
  quantidade: number;
  motivo?: string;
  usuario_id?: string;
  usuario_nome?: string;
}

export async function createCancelamento(
  payload: CreateCancelamentoPayload
): Promise<CancelamentoPedido> {
  const { data, error } = await supabase
    .from('cancelamentos_pedido')
    .insert({
      pedido_origem_id: payload.pedido_origem_id,
      pedido_destino_id: payload.pedido_destino_id ?? null,
      tipo: payload.tipo,
      quantidade: payload.quantidade,
      motivo: payload.motivo ?? null,
      usuario_id: payload.usuario_id ?? null,
      usuario_nome: payload.usuario_nome ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapCancelamento(data);
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
  if (error || !data) return [];
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
  const { pedidoPai, filho, motivo, usuarioId, usuarioNome } = payload;
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

  // 1. Create child pedido
  const pedidoFilho = await createPedidoVenda({
    ...filho,
    pedido_pai_id: pedidoPai.id,
    status: 'pendente',
    status_pedido: 'ativo',
    quantidade_original: qtdFilho,
    quantidade_desmembrada: 0,
    quantidade_cancelada_definitiva: 0,
  });

  // 2. Update parent's quantidade_desmembrada
  const novaDesmembrada = (pedidoPai.quantidade_desmembrada ?? 0) + qtdFilho;
  await updatePedidoVenda(pedidoPai.id, {
    quantidade_desmembrada: novaDesmembrada,
  });

  // 3. Log cancelamento
  await createCancelamento({
    pedido_origem_id: pedidoPai.id,
    pedido_destino_id: pedidoFilho.id,
    tipo: 'canc_substitui',
    quantidade: qtdFilho,
    motivo,
    usuario_id: usuarioId,
    usuario_nome: usuarioNome,
  });

  return pedidoFilho;
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
  const { pedido, motivo, usuarioId, usuarioNome } = payload;
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

  const novaCancelada = (pedido.quantidade_cancelada_definitiva ?? 0) + qtdCancelar;

  const updates: Partial<PedidoVenda> = {
    quantidade_cancelada_definitiva: novaCancelada,
  };

  // If total cancellation (or all remaining saldo), mark as cancelled
  if (isTotal || qtdCancelar >= saldo) {
    updates.status = 'cancelado';
    updates.status_pedido = 'cancelado';
  }

  await updatePedidoVenda(pedido.id, updates);

  await createCancelamento({
    pedido_origem_id: pedido.id,
    tipo: 'definitivo',
    quantidade: qtdCancelar,
    motivo,
    usuario_id: usuarioId,
    usuario_nome: usuarioNome,
  });
}
