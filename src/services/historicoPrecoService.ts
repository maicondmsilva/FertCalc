import { supabase } from './supabase';

export interface HistoricoPrecoFormulado {
  id: string;
  produto_formulado_id: string;
  preco_final: number;
  pricing_id?: string;
  registrado_em: string;
  registrado_por?: string;
}

function mapHistorico(d: Record<string, unknown>): HistoricoPrecoFormulado {
  return {
    id: d.id as string,
    produto_formulado_id: d.produto_formulado_id as string,
    preco_final: Number(d.preco_final),
    pricing_id: d.pricing_id as string | undefined,
    registrado_em: d.registrado_em as string,
    registrado_por: d.registrado_por as string | undefined,
  };
}

export async function getHistoricoPrecos(
  produtoFormuladoId: string
): Promise<HistoricoPrecoFormulado[]> {
  const { data, error } = await supabase
    .from('historico_precos_formulados')
    .select('*')
    .eq('produto_formulado_id', produtoFormuladoId)
    .order('registrado_em', { ascending: true });
  if (error || !data) return [];
  return data.map(mapHistorico);
}

export async function addHistoricoPreco(
  entry: Omit<HistoricoPrecoFormulado, 'id' | 'registrado_em'>
): Promise<void> {
  const { error } = await supabase.from('historico_precos_formulados').insert({
    produto_formulado_id: entry.produto_formulado_id,
    preco_final: entry.preco_final,
    pricing_id: entry.pricing_id ?? null,
    registrado_por: entry.registrado_por ?? null,
  });
  if (error) {
    console.error('[addHistoricoPreco] error:', error);
  }
}
