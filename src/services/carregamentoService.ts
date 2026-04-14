import { supabase } from './supabase';
import {
  Carregamento,
  CotacaoFrete,
  Transportadora,
  Filial,
  AlertaCarregamento,
  HistoricoCarregamento,
  FiltrosRelatorioCarregamento,
  KPICarregamento,
  StatusCarregamento,
  TipoFrete,
} from '../types/carregamento';

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────

function mapCarregamento(d: Record<string, unknown>): Carregamento {
  return {
    id: d.id as string,
    pedido_precificacao_id: d.pedido_precificacao_id as string | undefined,
    numero_carregamento: d.numero_carregamento as string,
    filial_id: d.filial_id as string | undefined,
    filial: (d.filiais as Filial | undefined) ?? undefined,
    tipo_frete: d.tipo_frete as TipoFrete,
    status: d.status as StatusCarregamento,
    tipo_liberacao: d.tipo_liberacao as Carregamento['tipo_liberacao'],
    quantidade_total: Number(d.quantidade_total ?? 0),
    quantidade_liberada: Number(d.quantidade_liberada ?? 0),
    quantidade_carregada: Number(d.quantidade_carregada ?? 0),
    saldo_disponivel: d.saldo_disponivel != null ? Number(d.saldo_disponivel) : undefined,
    data_prevista_carregamento: d.data_prevista_carregamento as string | undefined,
    data_real_carregamento: d.data_real_carregamento as string | undefined,
    data_solicitacao_cotacao: d.data_solicitacao_cotacao as string | undefined,
    data_liberacao: d.data_liberacao as string | undefined,
    transportadora_id: d.transportadora_id as string | undefined,
    transportadora: (d.transportadoras as Transportadora | undefined) ?? undefined,
    valor_frete: d.valor_frete != null ? Number(d.valor_frete) : undefined,
    valor_frete_unitario:
      d.valor_frete_unitario != null ? Number(d.valor_frete_unitario) : undefined,
    observacoes: d.observacoes as string | undefined,
    obs_logistica: d.obs_logistica as string | undefined,
    liberado_por: d.liberado_por as string | undefined,
    criado_por: d.criado_por as string | undefined,
    criado_em: d.criado_em as string,
    atualizado_em: d.atualizado_em as string,
  };
}

function mapCotacao(d: Record<string, unknown>): CotacaoFrete {
  return {
    id: d.id as string,
    carregamento_id: d.carregamento_id as string,
    transportadora_id: d.transportadora_id as string | undefined,
    transportadora: (d.transportadoras as Transportadora | undefined) ?? undefined,
    valor_cotado: d.valor_cotado != null ? Number(d.valor_cotado) : undefined,
    prazo_dias: d.prazo_dias != null ? Number(d.prazo_dias) : undefined,
    validade_cotacao: d.validade_cotacao as string | undefined,
    status: d.status as CotacaoFrete['status'],
    observacoes: d.observacoes as string | undefined,
    arquivo_cotacao: d.arquivo_cotacao as string | undefined,
    solicitado_por: d.solicitado_por as string | undefined,
    respondido_por: d.respondido_por as string | undefined,
    criado_em: d.criado_em as string,
    atualizado_em: d.atualizado_em as string,
  };
}

function mapTransportadora(d: Record<string, unknown>): Transportadora {
  return {
    id: d.id as string,
    nome: d.nome as string,
    cnpj: d.cnpj as string | undefined,
    contato: d.contato as string | undefined,
    telefone: d.telefone as string | undefined,
    email: d.email as string | undefined,
    ativo: (d.ativo ?? true) as boolean,
    criado_em: d.criado_em as string | undefined,
  };
}

// Maps a `branches` table row (from Configurações) to the Filial interface
function mapBranchToFilial(d: Record<string, unknown>): Filial {
  return {
    id: d.id as string,
    nome: d.name as string,
    codigo: d.id_numeric != null ? String(d.id_numeric) : d.id ? (d.id as string).slice(0, 8) : '',
    ativo: (d.ativo ?? true) as boolean,
  };
}

// ─────────────────────────────────────────────────────────────
//  Filiais — busca da tabela `branches` (Configurações)
// ─────────────────────────────────────────────────────────────

export async function getFiliais(): Promise<Filial[]> {
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('ativo', true)
    .order('name');
  if (error || !data) return [];
  return data.map(mapBranchToFilial);
}

// ─────────────────────────────────────────────────────────────
//  Transportadoras
// ─────────────────────────────────────────────────────────────

export async function getTransportadoras(): Promise<Transportadora[]> {
  const { data, error } = await supabase
    .from('transportadoras')
    .select('*')
    .eq('ativo', true)
    .order('nome');
  if (error || !data) return [];
  return data.map(mapTransportadora);
}

export async function getAllTransportadoras(): Promise<Transportadora[]> {
  const { data, error } = await supabase.from('transportadoras').select('*').order('nome');
  if (error || !data) return [];
  return data.map(mapTransportadora);
}

export async function createTransportadora(
  payload: Omit<Transportadora, 'id' | 'criado_em'>
): Promise<Transportadora | null> {
  const { data, error } = await supabase.from('transportadoras').insert(payload).select().single();
  if (error || !data) return null;
  return mapTransportadora(data);
}

export async function updateTransportadora(
  id: string,
  payload: Partial<Omit<Transportadora, 'id' | 'criado_em'>>
): Promise<boolean> {
  const { error } = await supabase.from('transportadoras').update(payload).eq('id', id);
  return !error;
}

export async function deleteTransportadora(id: string): Promise<boolean> {
  const { error } = await supabase.from('transportadoras').delete().eq('id', id);
  return !error;
}

// ─────────────────────────────────────────────────────────────
//  Carregamentos
// ─────────────────────────────────────────────────────────────

export async function getCarregamentos(filialId?: string): Promise<Carregamento[]> {
  let query = supabase
    .from('carregamentos')
    .select('*, branches(*), transportadoras(*)')
    .order('criado_em', { ascending: false });

  if (filialId) {
    query = query.eq('filial_id', filialId);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((d) => ({
    ...mapCarregamento(d),
    filial: d.branches ? mapBranchToFilial(d.branches as Record<string, unknown>) : undefined,
    transportadora: d.transportadoras ? mapTransportadora(d.transportadoras) : undefined,
  }));
}

export async function getCarregamentoById(id: string): Promise<Carregamento | null> {
  const { data, error } = await supabase
    .from('carregamentos')
    .select('*, branches(*), transportadoras(*)')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return {
    ...mapCarregamento(data),
    filial: data.branches ? mapBranchToFilial(data.branches as Record<string, unknown>) : undefined,
    transportadora: data.transportadoras ? mapTransportadora(data.transportadoras) : undefined,
  };
}

export async function createCarregamento(
  payload: Omit<Carregamento, 'id' | 'criado_em' | 'atualizado_em' | 'filial' | 'transportadora'>
): Promise<Carregamento> {
  const { data, error } = await supabase.from('carregamentos').insert(payload).select().single();
  if (error || !data) {
    console.error('Erro ao criar carregamento:', error);
    throw error ?? new Error('Falha ao criar carregamento: nenhum dado retornado');
  }
  return mapCarregamento(data);
}

export async function updateCarregamento(
  id: string,
  payload: Partial<Omit<Carregamento, 'id' | 'criado_em' | 'filial' | 'transportadora'>>
): Promise<boolean> {
  const { error } = await supabase
    .from('carregamentos')
    .update({ ...payload, atualizado_em: new Date().toISOString() })
    .eq('id', id);
  return !error;
}

export async function updateStatusCarregamento(
  id: string,
  status: StatusCarregamento,
  extra?: Partial<Carregamento>
): Promise<boolean> {
  const { error } = await supabase
    .from('carregamentos')
    .update({ status, ...extra, atualizado_em: new Date().toISOString() })
    .eq('id', id);
  return !error;
}

export async function deleteCarregamento(id: string): Promise<boolean> {
  const { error } = await supabase.from('carregamentos').delete().eq('id', id);
  return !error;
}

// Generate a unique carregamento number with retry on conflict
export async function gerarNumeroCarregamento(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CAR-${year}-`;
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Find the highest existing sequence number for this year
    const { data } = await supabase
      .from('carregamentos')
      .select('numero_carregamento')
      .like('numero_carregamento', `${prefix}%`)
      .order('numero_carregamento', { ascending: false })
      .limit(1);

    let nextSeq = 1;
    if (data && data.length > 0) {
      const last = data[0].numero_carregamento as string;
      const lastSeq = parseInt(last.replace(prefix, ''), 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }

    const numero = `${prefix}${nextSeq.toString().padStart(4, '0')}`;

    // Verify uniqueness before returning
    const { count: existing } = await supabase
      .from('carregamentos')
      .select('*', { count: 'exact', head: true })
      .eq('numero_carregamento', numero);

    if (!existing || existing === 0) {
      return numero;
    }
  }

  // Fallback: use timestamp-based suffix to guarantee uniqueness
  const ts = Date.now().toString(36);
  return `${prefix}${ts}`;
}

// ─────────────────────────────────────────────────────────────
//  Cotações de Frete
// ─────────────────────────────────────────────────────────────

export async function getCotacoesCarregamento(carregamentoId: string): Promise<CotacaoFrete[]> {
  const { data, error } = await supabase
    .from('cotacoes_frete')
    .select('*, transportadoras(*)')
    .eq('carregamento_id', carregamentoId)
    .order('criado_em', { ascending: false });
  if (error || !data) return [];
  return data.map((d) => ({
    ...mapCotacao(d),
    transportadora: d.transportadoras ? mapTransportadora(d.transportadoras) : undefined,
  }));
}

export async function createCotacao(
  payload: Omit<CotacaoFrete, 'id' | 'criado_em' | 'atualizado_em' | 'transportadora'>
): Promise<CotacaoFrete | null> {
  const { data, error } = await supabase.from('cotacoes_frete').insert(payload).select().single();
  if (error || !data) return null;
  return mapCotacao(data);
}

export async function updateCotacao(
  id: string,
  payload: Partial<Omit<CotacaoFrete, 'id' | 'criado_em' | 'transportadora'>>
): Promise<boolean> {
  const { error } = await supabase
    .from('cotacoes_frete')
    .update({ ...payload, atualizado_em: new Date().toISOString() })
    .eq('id', id);
  return !error;
}

// ─────────────────────────────────────────────────────────────
//  Alertas
// ─────────────────────────────────────────────────────────────

export async function getAlertasCarregamento(userId: string): Promise<AlertaCarregamento[]> {
  const { data, error } = await supabase
    .from('alertas_carregamento')
    .select('*')
    .eq('destinatario_id', userId)
    .eq('lido', false)
    .order('criado_em', { ascending: false });
  if (error || !data) return [];
  return data as AlertaCarregamento[];
}

export async function marcarAlertaLido(id: string): Promise<boolean> {
  const { error } = await supabase.from('alertas_carregamento').update({ lido: true }).eq('id', id);
  return !error;
}

// ─────────────────────────────────────────────────────────────
//  Histórico
// ─────────────────────────────────────────────────────────────

export async function getHistoricoCarregamento(
  carregamentoId: string
): Promise<HistoricoCarregamento[]> {
  const { data, error } = await supabase
    .from('historico_carregamento')
    .select('*')
    .eq('carregamento_id', carregamentoId)
    .order('criado_em', { ascending: false });
  if (error || !data) return [];
  return data as HistoricoCarregamento[];
}

export async function addHistorico(
  carregamentoId: string,
  statusAnterior: string | undefined,
  statusNovo: string,
  descricao: string,
  alteradoPor: string
): Promise<void> {
  await supabase.from('historico_carregamento').insert({
    carregamento_id: carregamentoId,
    status_anterior: statusAnterior,
    status_novo: statusNovo,
    descricao,
    alterado_por: alteradoPor,
  });
}

// ─────────────────────────────────────────────────────────────
//  KPIs
// ─────────────────────────────────────────────────────────────

export async function getKPICarregamento(filialId?: string): Promise<KPICarregamento> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  let base = supabase.from('carregamentos').select('status, data_real_carregamento, valor_frete');
  if (filialId) {
    base = supabase
      .from('carregamentos')
      .select('status, data_real_carregamento, valor_frete')
      .eq('filial_id', filialId);
  }

  const { data } = await base;
  if (!data)
    return { aguardando_cotacao: 0, em_carregamento: 0, carregados_hoje: 0, valor_frete_mes: 0 };

  return {
    aguardando_cotacao: data.filter((d) => d.status === 'aguardando_cotacao').length,
    em_carregamento: data.filter((d) => d.status === 'em_carregamento').length,
    carregados_hoje: data.filter(
      (d) => d.status === 'carregado' && d.data_real_carregamento === today
    ).length,
    valor_frete_mes: data
      .filter(
        (d) =>
          d.status === 'carregado' &&
          d.data_real_carregamento &&
          d.data_real_carregamento >= firstDayOfMonth
      )
      .reduce((acc, d) => acc + Number(d.valor_frete ?? 0), 0),
  };
}

// ─────────────────────────────────────────────────────────────
//  Relatórios
// ─────────────────────────────────────────────────────────────

export async function getCarregamentosRelatorio(
  filtros: FiltrosRelatorioCarregamento
): Promise<Carregamento[]> {
  let query = supabase
    .from('carregamentos')
    .select('*, branches(*), transportadoras(*)')
    .order('criado_em', { ascending: false });

  if (filtros.filial_id) query = query.eq('filial_id', filtros.filial_id);
  if (filtros.tipo_frete) query = query.eq('tipo_frete', filtros.tipo_frete);
  if (filtros.status) query = query.eq('status', filtros.status);
  if (filtros.transportadora_id) query = query.eq('transportadora_id', filtros.transportadora_id);
  if (filtros.data_inicio) query = query.gte('criado_em', filtros.data_inicio);
  if (filtros.data_fim) query = query.lte('criado_em', filtros.data_fim + 'T23:59:59');

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((d) => ({
    ...mapCarregamento(d),
    filial: d.branches ? mapBranchToFilial(d.branches as Record<string, unknown>) : undefined,
    transportadora: d.transportadoras ? mapTransportadora(d.transportadoras) : undefined,
  }));
}

// ─────────────────────────────────────────────────────────────
//  Calendário
// ─────────────────────────────────────────────────────────────

export async function getCarregamentosCalendario(
  mes: number,
  ano: number,
  filialId?: string
): Promise<Carregamento[]> {
  const startDate = new Date(ano, mes - 1, 1).toISOString().slice(0, 10);
  const endDate = new Date(ano, mes, 0).toISOString().slice(0, 10);

  let query = supabase
    .from('carregamentos')
    .select('*, branches(*), transportadoras(*)')
    .not('data_prevista_carregamento', 'is', null)
    .gte('data_prevista_carregamento', startDate)
    .lte('data_prevista_carregamento', endDate);

  if (filialId) query = query.eq('filial_id', filialId);

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((d) => ({
    ...mapCarregamento(d),
    filial: d.branches ? mapBranchToFilial(d.branches as Record<string, unknown>) : undefined,
    transportadora: d.transportadoras ? mapTransportadora(d.transportadoras) : undefined,
  }));
}
