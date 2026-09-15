import { supabase } from './supabase';
import { ExecucaoCarregamento, StatusExecucaoCarregamento } from '../types/carregamento';
import { syncPedidoVendaStatus } from './pedidosVendaService';

async function triggerSyncForExecucao(carregamentoId: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('carregamentos')
      .select('pedido_venda_id')
      .eq('id', carregamentoId)
      .maybeSingle();
    if (!error && data?.pedido_venda_id) {
      await syncPedidoVendaStatus(data.pedido_venda_id);
    }
  } catch (e) {
    console.error('Erro ao sincronizar status do pedido de venda:', e);
  }
}

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
  if (error) throw error;
  return (data || []).map((row) => mapExecucao(row));
}

export async function createExecucao(
  payload: Omit<
    ExecucaoCarregamento,
    | 'id'
    | 'id_numeric'
    | 'data_inicio_carregamento'
    | 'data_conclusao_carregamento'
    | 'status'
    | 'quantidade_carregada'
    | 'criado_em'
    | 'atualizado_em'
  >
): Promise<ExecucaoCarregamento> {
  const { data, error } = await supabase.rpc('agendar_execucao_carregamento', {
    p_carregamento_id: payload.carregamento_id,
    p_motorista_nome: payload.motorista_nome,
    p_motorista_cpf: payload.motorista_cpf ?? null,
    p_placa_veiculo: payload.placa_veiculo,
    p_placa_carreta: payload.placa_carreta ?? null,
    p_quantidade: payload.quantidade_agendada,
    p_data_agendamento: payload.data_agendamento ?? null,
    p_observacoes: payload.observacoes ?? null,
  });
  if (error || !data) throw error ?? new Error('Falha ao criar execução');
  triggerSyncForExecucao(payload.carregamento_id);
  return mapExecucao(data);
}

export async function updateExecucaoStatus(
  id: string,
  status: StatusExecucaoCarregamento,
  extra?: Partial<ExecucaoCarregamento>
): Promise<boolean> {
  const acao =
    status === 'em_carregamento'
      ? 'iniciar'
      : status === 'concluido'
        ? 'concluir'
        : status === 'cancelado'
          ? 'cancelar'
          : null;
  if (!acao) throw new Error('Transição de execução não permitida.');

  const { error } = await supabase.rpc('transicionar_execucao_carregamento', {
    p_execucao_id: id,
    p_acao: acao,
    p_quantidade_carregada: extra?.quantidade_carregada ?? null,
    p_motivo: extra?.motivo_cancelamento ?? null,
  });
  if (error) throw error;
  if (!error) {
    // Sync order status in the background
    supabase
      .from('carregamento_execucoes')
      .select('carregamento_id')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.carregamento_id) {
          triggerSyncForExecucao(data.carregamento_id);
        }
      });
  }
  return true;
}

export async function cancelExecucao(id: string, motivo: string): Promise<boolean> {
  return updateExecucaoStatus(id, 'cancelado', { motivo_cancelamento: motivo });
}

export async function concluirExecucao(id: string, quantidade_carregada: number): Promise<boolean> {
  return updateExecucaoStatus(id, 'concluido', { quantidade_carregada });
}

export async function cancelarSaldoCarregamento(
  id: string,
  quantidade: number,
  motivo: string
): Promise<void> {
  const { error } = await supabase.rpc('cancelar_saldo_carregamento', {
    p_carregamento_id: id,
    p_quantidade: quantidade,
    p_motivo: motivo.trim(),
  });
  if (error) throw error;
}
