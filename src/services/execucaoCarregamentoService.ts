import { supabase } from './supabase';
import { ExecucaoCarregamento, StatusExecucaoCarregamento } from '../types/carregamento';

function mapExecucao(row: Record<string, unknown>): ExecucaoCarregamento {
  return {
    id: row.id as string,
    id_numeric: row.id_numeric != null ? Number(row.id_numeric) : undefined,
    carregamento_id: row.carregamento_id as string,
    motorista_nome: row.motorista_nome as string,
    motorista_cpf: row.motorista_cpf as string | undefined,
    placa_veiculo: row.placa_veiculo as string,
    placa_carreta: row.placa_carreta as string | undefined,
    quantidade_agendada: Number(row.quantidade_agendada ?? 0),
    quantidade_carregada:
      row.quantidade_carregada != null ? Number(row.quantidade_carregada) : undefined,
    data_agendamento: row.data_agendamento as string | undefined,
    data_inicio_carregamento: row.data_inicio_carregamento as string | undefined,
    data_conclusao_carregamento: row.data_conclusao_carregamento as string | undefined,
    status: row.status as StatusExecucaoCarregamento,
    motivo_cancelamento: row.motivo_cancelamento as string | undefined,
    observacoes: row.observacoes as string | undefined,
    criado_por: row.criado_por as string | undefined,
    criado_em: row.criado_em as string | undefined,
    atualizado_em: row.atualizado_em as string | undefined,
  };
}

export async function getExecucoesByCarregamento(
  carregamentoId: string
): Promise<ExecucaoCarregamento[]> {
  const { data, error } = await supabase
    .from('carregamento_execucoes')
    .select('*')
    .eq('carregamento_id', carregamentoId)
    .order('data_agendamento', { ascending: false });
  if (error || !data) return [];
  return data.map((row) => mapExecucao(row));
}

export async function createExecucao(
  payload: Omit<
    ExecucaoCarregamento,
    | 'id'
    | 'id_numeric'
    | 'data_agendamento'
    | 'data_inicio_carregamento'
    | 'data_conclusao_carregamento'
    | 'status'
    | 'quantidade_carregada'
    | 'criado_em'
    | 'atualizado_em'
  >
): Promise<ExecucaoCarregamento> {
  const { data, error } = await supabase
    .from('carregamento_execucoes')
    .insert({
      carregamento_id: payload.carregamento_id,
      motorista_nome: payload.motorista_nome,
      motorista_cpf: payload.motorista_cpf ?? null,
      placa_veiculo: payload.placa_veiculo,
      placa_carreta: payload.placa_carreta ?? null,
      quantidade_agendada: payload.quantidade_agendada,
      observacoes: payload.observacoes ?? null,
      criado_por: payload.criado_por ?? null,
      status: 'agendado',
    })
    .select('*')
    .single();
  if (error || !data) throw error ?? new Error('Falha ao criar execução');
  return mapExecucao(data);
}

export async function updateExecucaoStatus(
  id: string,
  status: StatusExecucaoCarregamento,
  extra?: Partial<ExecucaoCarregamento>
): Promise<boolean> {
  const payload: Record<string, unknown> = { status, atualizado_em: new Date().toISOString() };
  if (status === 'em_carregamento') payload.data_inicio_carregamento = new Date().toISOString();
  if (status === 'concluido') payload.data_conclusao_carregamento = new Date().toISOString();
  if (extra?.observacoes !== undefined) payload.observacoes = extra.observacoes;
  if (extra?.quantidade_carregada !== undefined)
    payload.quantidade_carregada = extra.quantidade_carregada;
  if (extra?.motivo_cancelamento !== undefined)
    payload.motivo_cancelamento = extra.motivo_cancelamento;

  const { error } = await supabase.from('carregamento_execucoes').update(payload).eq('id', id);
  return !error;
}

export async function cancelExecucao(id: string, motivo: string): Promise<boolean> {
  return updateExecucaoStatus(id, 'cancelado', { motivo_cancelamento: motivo });
}

export async function concluirExecucao(id: string, quantidade_carregada: number): Promise<boolean> {
  return updateExecucaoStatus(id, 'concluido', { quantidade_carregada });
}
