import { supabase } from './supabase';
import { mapPricingRecord } from './db';
import type { PricingRecord } from '../types';

/**
 * Só as colunas que o painel usa (sem matérias-primas, histórico, observações
 * e pedido de exclusão) e sem precificações excluídas. O banco já limita ao
 * que o usuário pode ver (RLS). Em erro, lança — o painel mostra o aviso em
 * vez de exibir zeros como se não houvesse vendas.
 */
export const DASHBOARD_PRICING_COLUMNS =
  'id, cod, user_id, user_name, date, status, approval_status, factors, summary, calculations, created_at';

export async function getDashboardPricings(): Promise<PricingRecord[]> {
  const { data, error } = await supabase
    .from('pricing_records')
    .select(DASHBOARD_PRICING_COLUMNS)
    .neq('status', 'Excluída')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => mapPricingRecord(row as Record<string, unknown>));
}
