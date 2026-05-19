import { supabase } from './supabase';
import { AccessLevel } from '../types';

function mapAccessLevel(row: Record<string, unknown>): AccessLevel {
  return {
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    description: row.description as string | undefined,
    is_system: Boolean(row.is_system),
    hierarchy_level: Number(row.hierarchy_level ?? 0),
    default_permissions: (row.default_permissions as Record<string, unknown>) ?? {},
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  };
}

function getFallbackLevels(): AccessLevel[] {
  return [
    {
      id: 'fallback-master',
      code: 'master',
      name: 'Master',
      is_system: true,
      hierarchy_level: 100,
      default_permissions: {},
    },
    {
      id: 'fallback-admin',
      code: 'admin',
      name: 'Administrador',
      is_system: true,
      hierarchy_level: 80,
      default_permissions: {},
    },
    {
      id: 'fallback-manager',
      code: 'manager',
      name: 'Gerente',
      is_system: false,
      hierarchy_level: 60,
      default_permissions: {},
    },
    {
      id: 'fallback-user',
      code: 'user',
      name: 'Vendedor',
      is_system: false,
      hierarchy_level: 40,
      default_permissions: {},
    },
  ];
}

export async function getAccessLevels(): Promise<AccessLevel[]> {
  const { data, error } = await supabase
    .from('access_levels')
    .select('*')
    .order('hierarchy_level', { ascending: false });
  if (error || !data) return getFallbackLevels();
  return data.map((row) => mapAccessLevel(row));
}

export async function createAccessLevel(
  payload: Omit<AccessLevel, 'id' | 'created_at' | 'updated_at' | 'is_system'> & {
    is_system?: boolean;
  }
): Promise<AccessLevel> {
  const { data, error } = await supabase
    .from('access_levels')
    .insert({
      code: payload.code.toLowerCase(),
      name: payload.name,
      description: payload.description ?? null,
      hierarchy_level: payload.hierarchy_level,
      default_permissions: payload.default_permissions ?? {},
      is_system: payload.is_system ?? false,
    })
    .select('*')
    .single();
  if (error || !data) throw error ?? new Error('Falha ao criar nível de acesso');
  return mapAccessLevel(data);
}

export async function updateAccessLevel(
  id: string,
  payload: Partial<Omit<AccessLevel, 'id' | 'created_at' | 'updated_at' | 'is_system'>>
): Promise<boolean> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (payload.code !== undefined) updates.code = payload.code.toLowerCase();
  if (payload.name !== undefined) updates.name = payload.name;
  if (payload.description !== undefined) updates.description = payload.description;
  if (payload.hierarchy_level !== undefined) updates.hierarchy_level = payload.hierarchy_level;
  if (payload.default_permissions !== undefined)
    updates.default_permissions = payload.default_permissions;
  const { error } = await supabase.from('access_levels').update(updates).eq('id', id);
  return !error;
}

export async function deleteAccessLevel(id: string): Promise<boolean> {
  const { data: level, error: levelError } = await supabase
    .from('access_levels')
    .select('id, code, is_system')
    .eq('id', id)
    .single();
  if (levelError || !level) return false;
  if (level.is_system) throw new Error('Níveis de sistema não podem ser excluídos.');

  const { count, error: countError } = await supabase
    .from('app_users')
    .select('id', { count: 'exact', head: true })
    .eq('role', level.code);
  if (countError) throw countError;
  if ((count ?? 0) > 0) {
    throw new Error('Este nível está em uso por usuários e não pode ser excluído.');
  }

  const { error } = await supabase.from('access_levels').delete().eq('id', id);
  return !error;
}
