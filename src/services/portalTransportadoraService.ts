import { supabase } from './supabase';
import type { StatusCotacao } from '../types/carregamento';

export interface CotacaoPortalTransportadora {
  id: string;
  carregamento_id: string;
  numero_carregamento: string;
  tipo_frete: string;
  quantidade_total: number;
  data_prevista_carregamento?: string;
  local_carregamento?: string;
  cidade_origem?: string;
  estado_origem?: string;
  valor_cotado?: number;
  prazo_dias?: number;
  validade_cotacao?: string;
  status: StatusCotacao;
  observacoes?: string;
  criado_em: string;
  atualizado_em: string;
}

export async function listarCotacoesPortal(): Promise<CotacaoPortalTransportadora[]> {
  const { data, error } = await supabase.rpc('get_portal_transportadora_cotacoes');
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((item) => ({
    ...item,
    quantidade_total: Number(item.quantidade_total ?? 0),
    valor_cotado: item.valor_cotado == null ? undefined : Number(item.valor_cotado),
    prazo_dias: item.prazo_dias == null ? undefined : Number(item.prazo_dias),
  })) as CotacaoPortalTransportadora[];
}

export interface RespostaCotacaoPortal {
  aceitar: boolean;
  valorCotado?: number;
  prazoDias?: number;
  validadeCotacao?: string;
  observacoes?: string;
}

export async function responderCotacaoPortal(
  cotacaoId: string,
  resposta: RespostaCotacaoPortal
): Promise<void> {
  const { error } = await supabase.rpc('responder_cotacao_transportadora', {
    p_cotacao_id: cotacaoId,
    p_aceitar: resposta.aceitar,
    p_valor_cotado: resposta.valorCotado ?? null,
    p_prazo_dias: resposta.prazoDias ?? null,
    p_validade_cotacao: resposta.validadeCotacao ?? null,
    p_observacoes: resposta.observacoes?.trim() || null,
  });
  if (error) throw error;
}
