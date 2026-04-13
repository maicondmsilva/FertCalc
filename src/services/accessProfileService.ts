/**
 * FertCalc Pro — Access Profile Service
 * CRUD para perfis de acesso (templates de permissões reutilizáveis).
 */

import { supabase } from './supabase';

export interface AccessProfile {
  id: string;
  name: string;
  description?: string;
  permissions: Record<string, boolean | string>;
  created_at: string;
  updated_at: string;
}

type NewAccessProfile = Omit<AccessProfile, 'id' | 'created_at' | 'updated_at'>;

function mapProfile(row: Record<string, unknown>): AccessProfile {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string | undefined) ?? undefined,
    permissions: (row.permissions as Record<string, boolean | string>) ?? {},
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function getAccessProfiles(): Promise<AccessProfile[]> {
  const { data, error } = await supabase
    .from('access_profiles')
    .select('*')
    .order('name');
  if (error || !data) return [];
  return data.map(mapProfile);
}

export async function createAccessProfile(profile: NewAccessProfile): Promise<AccessProfile> {
  const { data, error } = await supabase
    .from('access_profiles')
    .insert({
      name: profile.name,
      description: profile.description ?? null,
      permissions: profile.permissions,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Erro ao criar perfil de acesso');
  return mapProfile(data as Record<string, unknown>);
}

export async function updateAccessProfile(
  id: string,
  profile: Partial<NewAccessProfile>
): Promise<AccessProfile> {
  const payload: Record<string, unknown> = {};
  if (profile.name !== undefined) payload.name = profile.name;
  if (profile.description !== undefined) payload.description = profile.description;
  if (profile.permissions !== undefined) payload.permissions = profile.permissions;

  const { data, error } = await supabase
    .from('access_profiles')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Erro ao atualizar perfil de acesso');
  return mapProfile(data as Record<string, unknown>);
}

export async function deleteAccessProfile(id: string): Promise<void> {
  const { error } = await supabase.from('access_profiles').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
