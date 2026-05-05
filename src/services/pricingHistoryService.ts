import { supabase } from './supabase';

export interface PricingHistoryEntry {
  id: string;
  pricing_id: string;
  campo: string;
  valor_anterior?: string;
  valor_novo?: string;
  alterado_por: string;
  alterado_em: string;
}

function mapEntry(d: Record<string, unknown>): PricingHistoryEntry {
  return {
    id: d.id as string,
    pricing_id: d.pricing_id as string,
    campo: d.campo as string,
    valor_anterior: d.valor_anterior as string | undefined,
    valor_novo: d.valor_novo as string | undefined,
    alterado_por: d.alterado_por as string,
    alterado_em: d.alterado_em as string,
  };
}

export async function getPricingHistory(pricingId: string): Promise<PricingHistoryEntry[]> {
  const { data, error } = await supabase
    .from('pricing_history')
    .select('*')
    .eq('pricing_id', pricingId)
    .order('alterado_em', { ascending: false });
  if (error || !data) return [];
  return data.map(mapEntry);
}

export async function addPricingHistory(
  entry: Omit<PricingHistoryEntry, 'id' | 'alterado_em'>
): Promise<void> {
  const { error } = await supabase.from('pricing_history').insert({
    pricing_id: entry.pricing_id,
    campo: entry.campo,
    valor_anterior: entry.valor_anterior ?? null,
    valor_novo: entry.valor_novo ?? null,
    alterado_por: entry.alterado_por,
  });
  if (error) {
    console.error('[addPricingHistory] error:', error);
  }
}
