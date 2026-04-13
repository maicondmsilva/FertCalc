import { supabase } from './supabase';
import type { PedidoVenda, StatusPedidoVenda } from '../types/pedidoVenda';

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────

function mapPedido(d: Record<string, unknown>): PedidoVenda {
  return {
    id: d.id as string,
    precificacao_id: d.precificacao_id as string,
    numero_pedido: d.numero_pedido as string | undefined,
    barra_pedido: d.barra_pedido as string | undefined,
    data_pedido: d.data_pedido as string | undefined,
    quantidade_real: d.quantidade_real != null ? Number(d.quantidade_real) : undefined,
    valor_unitario_negociado:
      d.valor_unitario_negociado != null ? Number(d.valor_unitario_negociado) : undefined,
    valor_total_negociado:
      d.valor_total_negociado != null ? Number(d.valor_total_negociado) : undefined,
    embalagem: d.embalagem as string | undefined,
    tipo_frete: d.tipo_frete as string | undefined,
    valor_frete: d.valor_frete != null ? Number(d.valor_frete) : undefined,
    status: (d.status as StatusPedidoVenda) || 'pendente',
    pdf_url: d.pdf_url as string | undefined,
    dados_extraidos: d.dados_extraidos as Record<string, unknown> | undefined,
    importado_por: d.importado_por as string | undefined,
    criado_em: d.criado_em as string,
    atualizado_em: d.atualizado_em as string,
  };
}

// ─────────────────────────────────────────────────────────────
//  CRUD
// ─────────────────────────────────────────────────────────────

export async function getPedidosVenda(): Promise<PedidoVenda[]> {
  const { data, error } = await supabase
    .from('pedidos_venda')
    .select('*')
    .order('criado_em', { ascending: false });
  if (error || !data) return [];
  return data.map(mapPedido);
}

export async function getPedidoByPrecificacaoId(
  precificacaoId: string
): Promise<PedidoVenda | null> {
  const { data, error } = await supabase
    .from('pedidos_venda')
    .select('*')
    .eq('precificacao_id', precificacaoId)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return mapPedido(data);
}

export async function createPedidoVenda(
  pedido: Omit<PedidoVenda, 'id' | 'criado_em' | 'atualizado_em'>
): Promise<PedidoVenda | null> {
  const { data, error } = await supabase.from('pedidos_venda').insert(pedido).select().single();
  if (error || !data) return null;
  return mapPedido(data);
}

export async function updatePedidoVenda(id: string, fields: Partial<PedidoVenda>): Promise<void> {
  const { error } = await supabase
    .from('pedidos_venda')
    .update({ ...fields, atualizado_em: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function updatePedidoStatus(id: string, status: StatusPedidoVenda): Promise<void> {
  await updatePedidoVenda(id, { status });
}

export async function deletePedidoVenda(id: string): Promise<void> {
  const { error } = await supabase.from('pedidos_venda').delete().eq('id', id);
  if (error) throw error;
}
