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

// Níveis são fixos: as regras de segurança do banco dependem da hierarquia de
// cada um (alterar o número mudava o poder de todos com aquele nível). Por isso
// não há mais criar/editar/excluir pelo app; o banco também bloqueia.
