import { supabase } from './supabase';
import { PedidoVenda } from '../types';

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
    saldo_disponivel: d.saldo_disponivel != null ? Number(d.saldo_disponivel) : undefined,
    preco_unitario: d.preco_unitario != null ? Number(d.preco_unitario) : undefined,
    condicao_pagamento: d.condicao_pagamento as string | undefined,
    observacoes: d.observacoes as string | undefined,
    filial_id: d.filial_id as string | undefined,
    formulacao_alterada: d.formulacao_alterada as boolean | undefined,
    pedido_pai_id: d.pedido_pai_id as string | undefined,
  };
}

export async function getPedidosVenda(filtros?: {
  clienteNome?: string;
  status?: string;
  filialId?: string;
}): Promise<PedidoVenda[]> {
  let query = supabase
    .from('pedidos_venda')
    .select('*')
    .order('criado_em', { ascending: false });

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
      precificacao_id: pedido.precificacao_id,
      numero_pedido: pedido.numero_pedido,
      barra_pedido: pedido.barra_pedido,
      data_pedido: pedido.data_pedido,
      quantidade_real: pedido.quantidade_real,
      embalagem: pedido.embalagem,
      valor_unitario_negociado: pedido.valor_unitario_negociado,
      valor_total_negociado: pedido.valor_total_negociado,
      tipo_frete: pedido.tipo_frete,
      valor_frete: pedido.valor_frete,
      status: pedido.status ?? 'pendente',
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
      embalagem: updates.embalagem,
      valor_unitario_negociado: updates.valor_unitario_negociado,
      valor_total_negociado: updates.valor_total_negociado,
      tipo_frete: updates.tipo_frete,
      valor_frete: updates.valor_frete,
      status: updates.status,
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
