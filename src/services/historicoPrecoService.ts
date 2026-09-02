import { supabase } from './supabase';

export interface HistoricoPrecoFormulado {
  id: string;
  produto_formulado_id: string;
  preco_final: number;
  pricing_id?: string;
  registrado_em: string;
  registrado_por?: string;
  saved_formula_id?: string;
  organization_id?: string;
  local_carregamento_id?: string;
  local_carregamento_nome?: string;
  price_list_id?: string;
  price_list_name?: string;
  formula_nome?: string;
  preco_base?: number;
  quantidade_tons?: number;
  valor_total?: number;
  fatores_comerciais?: Record<string, unknown>;
  origem?: 'precificacao' | 'relatorio_precos';
}

function mapHistorico(d: Record<string, unknown>): HistoricoPrecoFormulado {
  return {
    id: d.id as string,
    produto_formulado_id: d.produto_formulado_id as string,
    preco_final: Number(d.preco_final),
    pricing_id: d.pricing_id as string | undefined,
    registrado_em: d.registrado_em as string,
    registrado_por: d.registrado_por as string | undefined,
    saved_formula_id: d.saved_formula_id as string | undefined,
    organization_id: d.organization_id as string | undefined,
    local_carregamento_id: d.local_carregamento_id as string | undefined,
    local_carregamento_nome: d.local_carregamento_nome as string | undefined,
    price_list_id: d.price_list_id as string | undefined,
    price_list_name: d.price_list_name as string | undefined,
    formula_nome: d.formula_nome as string | undefined,
    preco_base: d.preco_base != null ? Number(d.preco_base) : undefined,
    quantidade_tons: d.quantidade_tons != null ? Number(d.quantidade_tons) : undefined,
    valor_total: d.valor_total != null ? Number(d.valor_total) : undefined,
    fatores_comerciais: (d.fatores_comerciais || {}) as Record<string, unknown>,
    origem: d.origem as HistoricoPrecoFormulado['origem'],
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
  if (error) throw error;
  if (!data) return [];
  return data.map(mapHistorico);
}

export async function addHistoricoPreco(
  entry: Omit<HistoricoPrecoFormulado, 'id' | 'registrado_em'>
): Promise<void> {
  return addHistoricoPrecos([entry]);
}

export async function addHistoricoPrecos(
  entries: Array<Omit<HistoricoPrecoFormulado, 'id' | 'registrado_em'>>
): Promise<void> {
  if (entries.length === 0) return;
  const { error } = await supabase.from('historico_precos_formulados').insert(
    entries.map((entry) => ({
      produto_formulado_id: entry.produto_formulado_id,
      preco_final: entry.preco_final,
      pricing_id: entry.pricing_id ?? null,
      registrado_por: entry.registrado_por ?? null,
      saved_formula_id: entry.saved_formula_id ?? null,
      organization_id: entry.organization_id ?? null,
      local_carregamento_id: entry.local_carregamento_id ?? null,
      local_carregamento_nome: entry.local_carregamento_nome ?? null,
      price_list_id: entry.price_list_id ?? null,
      price_list_name: entry.price_list_name ?? null,
      formula_nome: entry.formula_nome ?? null,
      preco_base: entry.preco_base ?? null,
      quantidade_tons: entry.quantidade_tons ?? null,
      valor_total: entry.valor_total ?? null,
      fatores_comerciais: entry.fatores_comerciais ?? {},
      origem: entry.origem ?? 'precificacao',
    }))
  );
  if (error) {
    console.error('[addHistoricoPreco] error:', error);
  }
}
