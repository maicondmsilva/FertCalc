import { supabase } from './supabase';
import type {
  NovaProposta,
  Proposta,
  PropostaComposicaoItem,
  PropostaEvento,
  PropostaItem,
} from '../types/proposta';

type Row = Record<string, unknown>;

const num = (value: unknown) => (value == null || value === '' ? 0 : Number(value));
const optNum = (value: unknown) => (value == null || value === '' ? undefined : Number(value));
const optStr = (value: unknown) => (value == null || value === '' ? undefined : String(value));

/** Mensagens do banco já vêm em português; outras viram uma mensagem genérica. */
function erroProposta(error: { code?: string; message?: string } | null, fallback: string): Error {
  if (error?.code && ['42501', '22023', 'P0002', '23502'].includes(error.code) && error.message) {
    return new Error(error.message);
  }
  return new Error(fallback);
}

export function mapProposta(row: Row): Proposta {
  const contagem = row.propostas_precos_itens as Array<{ count: number }> | undefined;
  return {
    id: String(row.id),
    numero: num(row.numero),
    criadoPor: String(row.criado_por ?? ''),
    criadoPorNome: String(row.criado_por_nome ?? ''),
    regionId: optStr(row.region_id),
    clientId: optStr(row.client_id),
    clienteNome: String(row.cliente_nome ?? ''),
    clienteDocumento: optStr(row.cliente_documento),
    clienteDados: (row.cliente_dados as Proposta['clienteDados']) || {},
    priceListId: optStr(row.price_list_id),
    priceListNome: optStr(row.price_list_nome),
    localCarregamentoId: optStr(row.local_carregamento_id),
    localNome: optStr(row.local_nome),
    moeda: row.moeda === 'USD' ? 'USD' : 'BRL',
    taxaCambio: optNum(row.taxa_cambio),
    validaAte: String(row.valida_ate ?? '').slice(0, 10),
    incluirComposicao: Boolean(row.incluir_composicao),
    observacoes: optStr(row.observacoes),
    status: (row.status as Proposta['status']) || 'vigente',
    pricingId: optStr(row.pricing_id),
    valorTotal: num(row.valor_total),
    toneladasTotal: num(row.toneladas_total),
    quantidadeItens: contagem?.[0]?.count ?? 0,
    createdAt: String(row.created_at ?? ''),
  };
}

export function mapPropostaItem(row: Row): PropostaItem {
  return {
    id: optStr(row.id),
    ordem: num(row.ordem),
    savedFormulaId: optStr(row.saved_formula_id),
    codigo: optStr(row.codigo),
    formulaNome: String(row.formula_nome ?? ''),
    npk: optStr(row.npk),
    garantias: optStr(row.garantias),
    embalagem: optStr(row.embalagem),
    precoTonelada: num(row.preco_tonelada),
    quantidadeSugerida: optNum(row.quantidade_sugerida),
    composicao: Array.isArray(row.composicao) ? (row.composicao as PropostaComposicaoItem[]) : [],
    fatores: (row.fatores as Record<string, unknown>) || {},
  };
}

const mapEvento = (row: Row): PropostaEvento => ({
  id: String(row.id),
  tipo: String(row.tipo ?? ''),
  descricao: String(row.descricao ?? ''),
  criadoPorNome: optStr(row.criado_por_nome),
  createdAt: String(row.created_at ?? ''),
});

export async function listPropostas(): Promise<Proposta[]> {
  const { data, error } = await supabase
    .from('propostas_precos')
    .select('*, propostas_precos_itens(count)')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw erroProposta(error, 'Não foi possível carregar as propostas.');
  return (data || []).map((row) => mapProposta(row as Row));
}

export async function getProposta(id: string): Promise<Proposta> {
  const [cabecalho, itens, eventos] = await Promise.all([
    supabase.from('propostas_precos').select('*').eq('id', id).single(),
    supabase.from('propostas_precos_itens').select('*').eq('proposta_id', id).order('ordem'),
    supabase
      .from('propostas_precos_eventos')
      .select('*')
      .eq('proposta_id', id)
      .order('created_at', { ascending: false }),
  ]);
  if (cabecalho.error || !cabecalho.data)
    throw erroProposta(cabecalho.error, 'Proposta não encontrada.');
  if (itens.error) throw erroProposta(itens.error, 'Não foi possível carregar os produtos.');
  const proposta = mapProposta(cabecalho.data as Row);
  proposta.itens = (itens.data || []).map((row) => mapPropostaItem(row as Row));
  proposta.quantidadeItens = proposta.itens.length;
  proposta.eventos = eventos.error ? [] : (eventos.data || []).map((row) => mapEvento(row as Row));
  return proposta;
}

export async function criarProposta(nova: NovaProposta): Promise<string> {
  const { data, error } = await supabase.rpc('criar_proposta_precos', {
    p_proposta: {
      client_id: nova.clientId || null,
      cliente_nome: nova.clienteNome,
      cliente_documento: nova.clienteDocumento || null,
      cliente_dados: nova.clienteDados,
      region_id: nova.regionId || null,
      price_list_id: nova.priceListId || null,
      price_list_nome: nova.priceListNome || null,
      local_carregamento_id: nova.localCarregamentoId || null,
      local_nome: nova.localNome || null,
      moeda: nova.moeda,
      taxa_cambio: nova.taxaCambio ?? null,
      valida_ate: nova.validaAte,
      incluir_composicao: nova.incluirComposicao,
      observacoes: nova.observacoes || null,
    },
    p_itens: nova.itens.map((item) => ({
      saved_formula_id: item.savedFormulaId || null,
      codigo: item.codigo || null,
      formula_nome: item.formulaNome,
      npk: item.npk || null,
      garantias: item.garantias || null,
      embalagem: item.embalagem || null,
      preco_tonelada: item.precoTonelada,
      quantidade_sugerida: item.quantidadeSugerida ?? null,
      composicao: item.composicao,
      fatores: item.fatores || {},
    })),
  });
  if (error || !data) throw erroProposta(error, 'Não foi possível criar a proposta.');
  return String(data);
}

export async function alterarValidadeProposta(id: string, validaAte: string, motivo: string) {
  const { error } = await supabase.rpc('alterar_validade_proposta', {
    p_id: id,
    p_valida_ate: validaAte,
    p_motivo: motivo,
  });
  if (error) throw erroProposta(error, 'Não foi possível alterar a validade.');
}

export async function cancelarProposta(id: string, motivo: string) {
  const { error } = await supabase.rpc('cancelar_proposta', { p_id: id, p_motivo: motivo });
  if (error) throw erroProposta(error, 'Não foi possível cancelar a proposta.');
}

/** Registra no histórico que o PDF/Excel foi gerado (falha aqui não impede o arquivo). */
export async function registrarDocumentoProposta(id: string, formato: 'pdf' | 'excel') {
  await supabase.rpc('registrar_documento_proposta', { p_id: id, p_formato: formato });
}
