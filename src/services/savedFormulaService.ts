import type { RawMaterial, SavedFormula } from '../types';
import { supabase } from './supabase';

export interface SaveFormulaWithProductInput {
  id?: string;
  name: string;
  targetFormula: string;
  category?: SavedFormula['category'];
  targetCa?: number;
  targetS?: number;
  targetMicros?: Record<string, number>;
  macros: RawMaterial[];
  micros: RawMaterial[];
}

function mapSavedFormula(data: Record<string, unknown>): SavedFormula {
  return {
    id: data.id as string,
    organizationId: data.organization_id as string | undefined,
    id_numeric: data.id_numeric != null ? Number(data.id_numeric) : undefined,
    userId: data.user_id as string,
    userName: data.user_name as string,
    name: data.name as string,
    date: data.date as string,
    targetFormula: data.target_formula as string,
    category: data.category as SavedFormula['category'],
    targetCa: data.target_ca != null ? Number(data.target_ca) : undefined,
    targetS: data.target_s != null ? Number(data.target_s) : undefined,
    targetMicros: (data.target_micros as Record<string, number> | null) || undefined,
    macros: (data.macros as RawMaterial[]) || [],
    micros: (data.micros as RawMaterial[]) || [],
    arquivadaEm: (data.arquivada_em as string | null) || undefined,
  };
}

/** Mensagem clara quando a migração de arquivamento ainda não foi aplicada no banco. */
export function describeArchiveError(error: { code?: string; message?: string }): string {
  if (
    error?.code === 'PGRST202' ||
    /set_(saved_formula|produto_formulado)_archived/.test(error?.message || '')
  ) {
    return 'O banco ainda não tem a atualização de arquivamento. Peça ao administrador para aplicar a migração 20261119190000.';
  }
  if (error?.code === 'P0002') return 'Registro não encontrado ou sem permissão para alterá-lo.';
  return error?.message || 'Não foi possível concluir a operação.';
}

/** Arquiva (ou restaura) a batida e o produto formulado ligado a ela, juntos. */
export async function setSavedFormulaArchived(id: string, archived: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_saved_formula_archived', {
    p_formula_id: id,
    p_archived: archived,
  });
  if (error) throw new Error(describeArchiveError(error));
}

export async function saveFormulaWithProduct(
  input: SaveFormulaWithProductInput
): Promise<SavedFormula> {
  const { data, error } = await supabase.rpc('save_formula_with_product', {
    p_formula_id: input.id || null,
    p_name: input.name.trim(),
    p_target_formula: input.targetFormula,
    p_category: input.category ?? 'all',
    p_target_ca: input.targetCa ?? null,
    p_target_s: input.targetS ?? null,
    p_target_micros: input.targetMicros ?? {},
    p_macros: input.macros,
    p_micros: input.micros,
  });

  if (error) {
    console.error('[saveFormulaWithProduct] Supabase error:', error);
    throw new Error(error.message || 'Não foi possível salvar a batida.');
  }
  if (!data) throw new Error('O banco não confirmou o salvamento da batida.');
  return mapSavedFormula(data as Record<string, unknown>);
}
