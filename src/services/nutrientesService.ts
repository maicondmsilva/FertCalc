import { supabase } from './supabase';
import { registerNutrients } from '../utils/micronutrients';

export type NutrientType = 'micro' | 'secundario';

export interface Nutriente {
  id: string;
  sigla: string;
  nome: string;
  tipo: NutrientType;
  aliases: string[];
  ordem: number;
  ativo: boolean;
}

function mapNutriente(row: Record<string, unknown>): Nutriente {
  return {
    id: String(row.id),
    sigla: String(row.sigla ?? ''),
    nome: String(row.nome ?? ''),
    tipo: row.tipo === 'secundario' ? 'secundario' : 'micro',
    aliases: Array.isArray(row.aliases) ? (row.aliases as string[]) : [],
    ordem: Number(row.ordem) || 0,
    ativo: row.ativo !== false,
  };
}

/** Cadastro de nutrientes da organização, já ligado ao cálculo (registerNutrients). */
export async function getNutrientes(): Promise<Nutriente[]> {
  const { data, error } = await supabase
    .from('nutrientes')
    .select('*')
    .order('ordem')
    .order('sigla');
  if (error) throw error;
  const nutrientes = (data || []).map(mapNutriente);
  registerNutrients(nutrientes);
  return nutrientes;
}

export type NutrienteInput = Omit<Nutriente, 'id'>;

/** Nomes alternativos guardados em maiúsculas, sem repetir a sigla nem o nome. */
export function cleanAliases(input: Pick<Nutriente, 'sigla' | 'nome' | 'aliases'>): string[] {
  const own = new Set([input.sigla.trim().toUpperCase(), input.nome.trim().toUpperCase()]);
  return [
    ...new Set(
      input.aliases
        .map((alias) => alias.trim().toUpperCase())
        .filter((alias) => alias && !own.has(alias))
    ),
  ];
}

function toDb(input: NutrienteInput) {
  return {
    sigla: input.sigla.trim(),
    nome: input.nome.trim(),
    tipo: input.tipo,
    aliases: cleanAliases(input),
    ordem: Math.round(input.ordem) || 0,
    ativo: input.ativo,
    atualizado_em: new Date().toISOString(),
  };
}

export async function createNutriente(input: NutrienteInput): Promise<void> {
  const { error } = await supabase.from('nutrientes').insert(toDb(input));
  if (error) throw error;
}

export async function updateNutriente(id: string, input: NutrienteInput): Promise<void> {
  const { error } = await supabase.from('nutrientes').update(toDb(input)).eq('id', id);
  if (error) throw error;
}

/** Exclui o nutriente; o banco recusa (com a quantidade) se algum produto usa a garantia. */
export async function deleteNutriente(id: string): Promise<void> {
  const { error } = await supabase.rpc('excluir_nutriente', { p_id: id });
  if (error) throw error;
}
