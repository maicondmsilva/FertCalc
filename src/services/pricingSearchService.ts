import { supabase } from './supabase';
import { mapPricingRecord } from './db';
import type { PricingRecord } from '../types';
import { sanitizePricingSearchTerm } from '../utils/postgrestSearch';

export { sanitizePricingSearchTerm };

/**
 * Busca precificações pelo código ou nome do cliente direto no banco, no máximo
 * `limit` resultados (antes a tela baixava todo o histórico a cada busca).
 * O banco já limita ao que o usuário pode ver (RLS).
 */
export async function searchPricingRecords(term: string, limit = 10): Promise<PricingRecord[]> {
  const clean = sanitizePricingSearchTerm(term).replace(/^#/, '');
  if (!clean) return [];
  let query = supabase.from('pricing_records').select('*').neq('status', 'Excluída');
  const code = Number(clean);
  query =
    /^\d{1,9}$/.test(clean) && Number.isSafeInteger(code)
      ? query.or(`cod.eq.${code},factors->client->>name.ilike.*${clean}*`)
      : query.ilike('factors->client->>name', `%${clean}%`);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data || []).map(mapPricingRecord);
}
