import { supabase } from './supabase';
import { formatId } from '../utils/formatId';

export interface ProdutoFormulado {
  id: string;
  id_numeric?: number;
  idFormatado?: string;
  nome: string;
  formula_npk?: string;
  saved_formula_id?: string;
  linha_diferenciada: boolean;
  ativo: boolean;
  criado_em?: string;
  criado_por?: string;
}

function mapProduto(d: Record<string, unknown>): ProdutoFormulado {
  const id_numeric = d.id_numeric != null ? Number(d.id_numeric) : undefined;
  return {
    id: d.id as string,
    id_numeric,
    idFormatado: formatId(id_numeric, 'BAT-'),
    nome: d.nome as string,
    formula_npk: d.formula_npk as string | undefined,
    saved_formula_id: d.saved_formula_id as string | undefined,
    linha_diferenciada: Boolean(d.linha_diferenciada),
    ativo: Boolean(d.ativo),
    criado_em: d.criado_em as string | undefined,
    criado_por: d.criado_por as string | undefined,
  };
}

export async function getProdutosFormulados(): Promise<ProdutoFormulado[]> {
  const { data, error } = await supabase
    .from('produtos_formulados')
    .select('*')
    .order('id_numeric', { ascending: true });
  if (error || !data) return [];
  return data.map(mapProduto);
}

export async function createProdutoFormulado(
  payload: Omit<ProdutoFormulado, 'id' | 'id_numeric' | 'idFormatado' | 'criado_em'>
): Promise<ProdutoFormulado> {
  const { data, error } = await supabase
    .from('produtos_formulados')
    .insert({
      nome: payload.nome,
      formula_npk: payload.formula_npk || null,
      saved_formula_id: payload.saved_formula_id || null,
      linha_diferenciada: payload.linha_diferenciada ?? false,
      ativo: payload.ativo ?? true,
      criado_por: payload.criado_por || null,
    })
    .select()
    .single();
  if (error) {
    console.error('[createProdutoFormulado] Supabase error:', error);
    throw error;
  }
  return mapProduto(data);
}

export async function updateProdutoFormulado(
  id: string,
  payload: Partial<Omit<ProdutoFormulado, 'id' | 'id_numeric' | 'idFormatado' | 'criado_em'>>
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (payload.nome !== undefined) updates.nome = payload.nome;
  if (payload.formula_npk !== undefined) updates.formula_npk = payload.formula_npk || null;
  if (payload.saved_formula_id !== undefined)
    updates.saved_formula_id = payload.saved_formula_id || null;
  if (payload.linha_diferenciada !== undefined)
    updates.linha_diferenciada = payload.linha_diferenciada;
  if (payload.ativo !== undefined) updates.ativo = payload.ativo;
  if (payload.criado_por !== undefined) updates.criado_por = payload.criado_por || null;

  const { error } = await supabase.from('produtos_formulados').update(updates).eq('id', id);
  if (error) {
    console.error('[updateProdutoFormulado] Supabase error:', error);
    throw error;
  }
}

export async function getProdutoFormuladoBySavedFormulaId(
  savedFormulaId: string
): Promise<ProdutoFormulado | null> {
  const { data, error } = await supabase
    .from('produtos_formulados')
    .select('*')
    .eq('saved_formula_id', savedFormulaId)
    .maybeSingle();
  if (error || !data) return null;
  return mapProduto(data);
}
