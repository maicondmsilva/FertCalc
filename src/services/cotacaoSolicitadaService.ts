import { supabase } from './supabase';
import {
  CotacaoSolicitada,
  StatusCotacaoSolicitada,
  Filial,
  LocalCarregamento,
  Transportadora,
} from '../types/carregamento';

// ─────────────────────────────────────────────────────────────
//  Mapper interno
// ─────────────────────────────────────────────────────────────

function mapCotacaoSolicitada(d: Record<string, unknown>): CotacaoSolicitada {
  const branchRaw = d.branches as Record<string, unknown> | null | undefined;
  const filial: Filial | undefined = branchRaw
    ? {
        id: branchRaw.id as string,
        nome: branchRaw.name as string,
        codigo: branchRaw.id_numeric != null ? String(branchRaw.id_numeric) : (branchRaw.id as string).slice(0, 8),
        ativo: (branchRaw.ativo ?? true) as boolean,
      }
    : undefined;

  const localRaw = d.locais_carregamento as Record<string, unknown> | null | undefined;
  const local_carregamento: LocalCarregamento | undefined = localRaw
    ? {
        id: localRaw.id as string,
        id_numeric: Number(localRaw.id_numeric),
        nome: localRaw.nome as string,
        filial_id: localRaw.filial_id as string | undefined,
        endereco: localRaw.endereco as string | undefined,
        cidade: localRaw.cidade as string | undefined,
        estado: localRaw.estado as string | undefined,
        maps_url: localRaw.maps_url as string | undefined,
        ativo: Boolean(localRaw.ativo),
        criado_em: localRaw.criado_em as string | undefined,
        atualizado_em: localRaw.atualizado_em as string | undefined,
      }
    : undefined;

  const transpRaw = d.transportadoras as Record<string, unknown> | null | undefined;
  const transportadora: Transportadora | undefined = transpRaw
    ? {
        id: transpRaw.id as string,
        id_numeric: transpRaw.id_numeric != null ? Number(transpRaw.id_numeric) : undefined,
        nome: transpRaw.nome as string,
        cnpj: transpRaw.cnpj as string | undefined,
        contato: transpRaw.contato as string | undefined,
        telefone: transpRaw.telefone as string | undefined,
        email: transpRaw.email as string | undefined,
        ativo: (transpRaw.ativo ?? true) as boolean,
        criado_em: transpRaw.criado_em as string | undefined,
      }
    : undefined;

  return {
    id: d.id as string,
    numero_cotacao: d.numero_cotacao as string,
    solicitado_por: d.solicitado_por as string | undefined,
    solicitante_nome: d.solicitante_nome as string | undefined,
    cliente_id: d.cliente_id as string | undefined,
    cliente_nome: d.cliente_nome as string | undefined,
    filial_id: d.filial_id as string | undefined,
    filial,
    local_carregamento_id: d.local_carregamento_id as string | undefined,
    local_carregamento,
    endereco_entrega: d.endereco_entrega as string | undefined,
    fazenda: d.fazenda as string | undefined,
    maps_url: d.maps_url as string | undefined,
    pedido_venda_id: d.pedido_venda_id as string | undefined,
    produto: d.produto as string | undefined,
    quantidade_ton: d.quantidade_ton != null ? Number(d.quantidade_ton) : undefined,
    observacoes: d.observacoes as string | undefined,
    status: d.status as StatusCotacaoSolicitada,
    responsavel_id: d.responsavel_id as string | undefined,
    transportadora_id: d.transportadora_id as string | undefined,
    transportadora,
    transportadora_nome: d.transportadora_nome as string | undefined,
    valor_frete: d.valor_frete != null ? Number(d.valor_frete) : undefined,
    valor_frete_unitario: d.valor_frete_unitario != null ? Number(d.valor_frete_unitario) : undefined,
    prazo_entrega_dias: d.prazo_entrega_dias != null ? Number(d.prazo_entrega_dias) : undefined,
    obs_responsavel: d.obs_responsavel as string | undefined,
    cotado_em: d.cotado_em as string | undefined,
    aprovado_em: d.aprovado_em as string | undefined,
    precificacao_id: d.precificacao_id as string | undefined,
    criado_em: d.criado_em as string,
    atualizado_em: d.atualizado_em as string,
  };
}

// ─────────────────────────────────────────────────────────────
//  Gera número único: COT-{ANO}-{NNNN}
// ─────────────────────────────────────────────────────────────

export async function gerarNumeroCotacao(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `COT-${year}-`;
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { data } = await supabase
      .from('cotacoes_solicitadas')
      .select('numero_cotacao')
      .like('numero_cotacao', `${prefix}%`)
      .order('numero_cotacao', { ascending: false })
      .limit(1);

    let nextSeq = 1;
    if (data && data.length > 0) {
      const last = data[0].numero_cotacao as string;
      const lastSeq = parseInt(last.replace(prefix, ''), 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }

    const numero = `${prefix}${nextSeq.toString().padStart(4, '0')}`;

    const { count: existing } = await supabase
      .from('cotacoes_solicitadas')
      .select('*', { count: 'exact', head: true })
      .eq('numero_cotacao', numero);

    if (!existing || existing === 0) {
      return numero;
    }
  }

  const ts = Date.now().toString(36);
  return `${prefix}${ts}`;
}

// ─────────────────────────────────────────────────────────────
//  Queries
// ─────────────────────────────────────────────────────────────

const SELECT_FIELDS = '*, branches(*), locais_carregamento(*), transportadoras(*)';

export async function getCotacoesByVendedor(userId: string): Promise<CotacaoSolicitada[]> {
  const { data, error } = await supabase
    .from('cotacoes_solicitadas')
    .select(SELECT_FIELDS)
    .eq('solicitado_por', userId)
    .order('criado_em', { ascending: false });

  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapCotacaoSolicitada);
}

export async function getCotacoesByFiliais(filialIds: string[]): Promise<CotacaoSolicitada[]> {
  if (filialIds.length === 0) {
    const { data, error } = await supabase
      .from('cotacoes_solicitadas')
      .select(SELECT_FIELDS)
      .in('status', ['aguardando', 'em_analise', 'cotado'])
      .order('criado_em', { ascending: true });
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map(mapCotacaoSolicitada);
  }

  const { data, error } = await supabase
    .from('cotacoes_solicitadas')
    .select(SELECT_FIELDS)
    .in('filial_id', filialIds)
    .in('status', ['aguardando', 'em_analise', 'cotado'])
    .order('criado_em', { ascending: true });

  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapCotacaoSolicitada);
}

export async function getCotacoesAprovadas(filialIds: string[]): Promise<CotacaoSolicitada[]> {
  let query = supabase
    .from('cotacoes_solicitadas')
    .select(SELECT_FIELDS)
    .eq('status', 'aprovado')
    .order('aprovado_em', { ascending: false });

  if (filialIds.length > 0) {
    query = query.in('filial_id', filialIds);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapCotacaoSolicitada);
}

// ─────────────────────────────────────────────────────────────
//  CRUD
// ─────────────────────────────────────────────────────────────

export async function createCotacaoSolicitada(
  payload: Omit<CotacaoSolicitada, 'id' | 'numero_cotacao' | 'criado_em' | 'atualizado_em' | 'filial' | 'local_carregamento' | 'transportadora'>
): Promise<CotacaoSolicitada> {
  const numero_cotacao = await gerarNumeroCotacao();

  const { data, error } = await supabase
    .from('cotacoes_solicitadas')
    .insert({ ...payload, numero_cotacao })
    .select(SELECT_FIELDS)
    .single();

  if (error || !data) throw error ?? new Error('Erro ao criar cotação solicitada');
  return mapCotacaoSolicitada(data as Record<string, unknown>);
}

export async function updateCotacaoSolicitada(
  id: string,
  updates: Partial<Omit<CotacaoSolicitada, 'id' | 'numero_cotacao' | 'criado_em' | 'filial' | 'local_carregamento' | 'transportadora'>>
): Promise<void> {
  const { error } = await supabase
    .from('cotacoes_solicitadas')
    .update({ ...updates, atualizado_em: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}
