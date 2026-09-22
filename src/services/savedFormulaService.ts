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
  };
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
