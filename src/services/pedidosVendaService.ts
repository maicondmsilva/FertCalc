import { supabase } from './supabase';
import { PedidoVenda } from '../types';

function mapPedido(d: any): PedidoVenda {
  return {
    id: d.id,
    precificacao_id: d.precificacao_id,
    numero_pedido: d.numero_pedido,
    barra_pedido: d.barra_pedido,
    data_pedido: d.data_pedido,
    quantidade_real: d.quantidade_real != null ? Number(d.quantidade_real) : undefined,
    valor_unitario_negociado:
      d.valor_unitario_negociado != null ? Number(d.valor_unitario_negociado) : undefined,
    valor_total_negociado:
      d.valor_total_negociado != null ? Number(d.valor_total_negociado) : undefined,
    status: d.status ?? 'pendente',
    pdf_url: d.pdf_url,
    dados_extraidos: d.dados_extraidos,
    importado_por: d.importado_por,
    criado_em: d.criado_em,
    atualizado_em: d.atualizado_em,
  };
}

export async function getPedidosVenda(): Promise<PedidoVenda[]> {
  const { data, error } = await supabase
    .from('pedidos_venda')
    .select('*')
    .order('criado_em', { ascending: false });
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
      valor_unitario_negociado: pedido.valor_unitario_negociado,
      valor_total_negociado: pedido.valor_total_negociado,
      status: pedido.status ?? 'pendente',
      pdf_url: pedido.pdf_url,
      dados_extraidos: pedido.dados_extraidos,
      importado_por: pedido.importado_por,
    })
    .select()
    .single();
  if (error) throw error;
  return mapPedido(data);
}

export async function updatePedidoVenda(
  id: string,
  updates: Partial<PedidoVenda>
): Promise<void> {
  const { error } = await supabase
    .from('pedidos_venda')
    .update({
      numero_pedido: updates.numero_pedido,
      barra_pedido: updates.barra_pedido,
      data_pedido: updates.data_pedido,
      quantidade_real: updates.quantidade_real,
      valor_unitario_negociado: updates.valor_unitario_negociado,
      valor_total_negociado: updates.valor_total_negociado,
      status: updates.status,
      pdf_url: updates.pdf_url,
      dados_extraidos: updates.dados_extraidos,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
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
    .or(
      `numero_pedido.ilike.%${query}%,barra_pedido.ilike.%${query}%`
    )
    .order('criado_em', { ascending: false })
    .limit(20);
  if (error || !data) return [];
  return data.map(mapPedido);
}
