import { supabase } from './supabase';
import { LocalCarregamento } from '../types/carregamento';

function mapLocal(d: Record<string, unknown>): LocalCarregamento {
  return {
    id: d.id as string,
    id_numeric: Number(d.id_numeric),
    nome: d.nome as string,
    filial_id: d.filial_id as string | undefined,
    endereco: d.endereco as string | undefined,
    cidade: d.cidade as string | undefined,
    estado: d.estado as string | undefined,
    maps_url: d.maps_url as string | undefined,
    ativo: Boolean(d.ativo),
    criado_em: d.criado_em as string | undefined,
    atualizado_em: d.atualizado_em as string | undefined,
  };
}

export async function getLocaisCarregamento(filialId?: string): Promise<LocalCarregamento[]> {
  let query = supabase
    .from('locais_carregamento')
    .select('*')
    .order('id_numeric', { ascending: true });

  if (filialId) {
    query = query.eq('filial_id', filialId);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(mapLocal);
}

export async function getLocaisAtivos(filialId?: string): Promise<LocalCarregamento[]> {
  let query = supabase
    .from('locais_carregamento')
    .select('*')
    .eq('ativo', true)
    .order('id_numeric', { ascending: true });

  if (filialId) {
    query = query.eq('filial_id', filialId);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(mapLocal);
}

export async function createLocalCarregamento(
  payload: Omit<LocalCarregamento, 'id' | 'id_numeric' | 'criado_em' | 'atualizado_em' | 'filial'>
): Promise<LocalCarregamento> {
  const { data, error } = await supabase
    .from('locais_carregamento')
    .insert({
      nome: payload.nome,
      filial_id: payload.filial_id || null,
      endereco: payload.endereco || null,
      cidade: payload.cidade || null,
      estado: payload.estado || null,
      maps_url: payload.maps_url || null,
      ativo: payload.ativo ?? true,
    })
    .select()
    .single();
  if (error) throw error;
  return mapLocal(data);
}

export async function updateLocalCarregamento(
  id: string,
  payload: Partial<Omit<LocalCarregamento, 'id' | 'id_numeric' | 'filial'>>
): Promise<void> {
  const updates: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  if (payload.nome !== undefined) updates.nome = payload.nome;
  if (payload.filial_id !== undefined) updates.filial_id = payload.filial_id || null;
  if (payload.endereco !== undefined) updates.endereco = payload.endereco || null;
  if (payload.cidade !== undefined) updates.cidade = payload.cidade || null;
  if (payload.estado !== undefined) updates.estado = payload.estado || null;
  if (payload.maps_url !== undefined) updates.maps_url = payload.maps_url || null;
  if (payload.ativo !== undefined) updates.ativo = payload.ativo;

  const { error } = await supabase.from('locais_carregamento').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteLocalCarregamento(id: string): Promise<void> {
  const { error } = await supabase.from('locais_carregamento').delete().eq('id', id);
  if (error) throw error;
}
