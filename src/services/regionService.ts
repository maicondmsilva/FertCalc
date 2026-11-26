import { supabase } from './supabase';
import type { Region } from '../types';

const mapRegion = (row: Record<string, unknown>): Region => ({
  id: String(row.id),
  organizationId: (row.organization_id as string) ?? undefined,
  name: String(row.name ?? ''),
  code: (row.code as string | null) ?? null,
  ativo: row.ativo !== false,
});

/** Regiões da organização (o banco limita pela RLS). */
export async function listRegions(): Promise<Region[]> {
  const { data, error } = await supabase.from('regions').select('*').order('name');
  if (error) throw error;
  return (data || []).map(mapRegion);
}

/** Vínculos usuário ↔ região (com a região principal de cada usuário). */
export async function listUserRegions(): Promise<
  { userId: string; regionId: string; principal: boolean }[]
> {
  const { data, error } = await supabase
    .from('user_regions')
    .select('user_id, region_id, principal');
  if (error) throw error;
  return (data || []).map((row) => ({
    userId: String(row.user_id),
    regionId: String(row.region_id),
    principal: row.principal === true,
  }));
}

/**
 * Salva as regiões de um usuário e a principal, numa só transação no banco.
 * Com uma região só, ela vira a principal.
 */
export async function setUserRegions(
  userId: string,
  regionIds: string[],
  principalRegionId: string | null
): Promise<void> {
  const { error } = await supabase.rpc('definir_regioes_usuario', {
    p_user_id: userId,
    p_region_ids: regionIds,
    p_principal: principalRegionId || null,
  });
  if (error) throw error;
}

export interface RegionDraft {
  name: string;
  code: string;
  ativo: boolean;
  userIds: string[];
}

/** Cria ou atualiza a região e acerta os usuários vinculados (só a diferença). */
export async function saveRegion(
  draft: RegionDraft,
  current: { id?: string; userIds: string[] }
): Promise<void> {
  const payload = {
    name: draft.name.trim(),
    code: draft.code.trim() ? draft.code.trim().toUpperCase() : null,
    ativo: draft.ativo,
  };
  let regionId = current.id;
  if (regionId) {
    const { error } = await supabase.from('regions').update(payload).eq('id', regionId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from('regions').insert(payload).select('id').single();
    if (error) throw error;
    regionId = String(data.id);
  }
  const before = new Set(current.userIds);
  const after = new Set(draft.userIds);
  const toAdd = draft.userIds.filter((userId) => !before.has(userId));
  const toRemove = current.userIds.filter((userId) => !after.has(userId));
  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('user_regions')
      .delete()
      .eq('region_id', regionId)
      .in('user_id', toRemove);
    if (error) throw error;
  }
  if (toAdd.length > 0) {
    const { error } = await supabase
      .from('user_regions')
      .insert(toAdd.map((userId) => ({ user_id: userId, region_id: regionId })));
    if (error) throw error;
  }
}

/** Exclui se não estiver em uso; senão desativa. */
export async function deleteOrDeactivateRegion(id: string): Promise<'excluida' | 'desativada'> {
  const { data, error } = await supabase.rpc('excluir_ou_desativar_regiao', { p_region_id: id });
  if (error) throw error;
  return data === 'desativada' ? 'desativada' : 'excluida';
}

/** Mensagem do banco em linguagem do usuário. */
export function regionErrorMessage(error: unknown): string {
  const raw = String((error as { message?: string })?.message || '');
  const code = (error as { code?: string })?.code;
  if (code === '23505') return 'Já existe uma região com esse nome ou código.';
  if (code === '42501' || /row-level security|permiss/i.test(raw))
    return 'Seu usuário não tem permissão para gerenciar regiões.';
  return 'Não foi possível salvar a região. Tente novamente.';
}
