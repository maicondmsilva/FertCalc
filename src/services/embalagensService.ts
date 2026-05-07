import { supabase } from './supabase';
import { Embalagem } from '../types';

function mapEmbalagem(data: Record<string, unknown>): Embalagem {
  const cobrar = data.cobrar === true;
  const descontar = data.descontar === true || data.desconto === true;
  const valorCobrar =
    data.valor_cobrar != null ? Number(data.valor_cobrar) : cobrar ? Number(data.valor || 0) : null;
  const valorDescontar =
    data.valor_descontar != null
      ? Number(data.valor_descontar)
      : descontar
        ? Number(data.valor || 0)
        : null;

  return {
    id: data.id as string,
    id_numeric: data.id_numeric as number,
    nome: data.nome as string,
    cobrar,
    descontar,
    valor_cobrar: Number.isFinite(valorCobrar) ? valorCobrar : null,
    valor_descontar: Number.isFinite(valorDescontar) ? valorDescontar : null,
    desconto: descontar,
    valor: Number(data.valor || 0),
    tipo_valor: (data.tipo_valor as 'por_tonelada' | 'fixo') || 'por_tonelada',
    ativo: data.ativo as boolean,
    criado_em: data.criado_em as string | undefined,
  };
}

export async function getEmbalagens(apenasAtivas = false): Promise<Embalagem[]> {
  let query = supabase.from('embalagens').select('*').order('id_numeric');
  if (apenasAtivas) query = query.eq('ativo', true);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((d) => mapEmbalagem(d as Record<string, unknown>));
}

export async function createEmbalagem(payload: Partial<Embalagem>): Promise<Embalagem> {
  const { data, error } = await supabase.from('embalagens').insert([payload]).select().single();
  if (error) throw error;
  return mapEmbalagem(data as Record<string, unknown>);
}

export async function updateEmbalagem(id: string, payload: Partial<Embalagem>): Promise<void> {
  const { error } = await supabase.from('embalagens').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteEmbalagem(id: string): Promise<void> {
  const { error } = await supabase.from('embalagens').delete().eq('id', id);
  if (error) throw error;
}
