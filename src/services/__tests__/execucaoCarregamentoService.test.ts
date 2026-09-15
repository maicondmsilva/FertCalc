import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, rpcMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('../supabase', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
  },
}));

import {
  concluirExecucao,
  cancelarSaldoCarregamento,
  getExecucoesByCarregamento,
  createExecucao,
  updateExecucaoStatus,
} from '../execucaoCarregamentoService';

describe('execucaoCarregamentoService', () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  it('propaga falha ao consultar execuções em vez de apresentar saldo livre', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: new Error('sem conexão') }),
    };
    fromMock.mockReturnValue(query);
    await expect(getExecucoesByCarregamento('car-1')).rejects.toThrow('sem conexão');
  });

  it('cancela por operação transacional e não confirma falha como sucesso', async () => {
    rpcMock.mockResolvedValueOnce({ error: null });
    await cancelarSaldoCarregamento('car-1', 5, ' Ajuste ');
    expect(rpcMock).toHaveBeenCalledWith('cancelar_saldo_carregamento', {
      p_carregamento_id: 'car-1',
      p_quantidade: 5,
      p_motivo: 'Ajuste',
    });
    expect(fromMock).not.toHaveBeenCalled();
    rpcMock.mockResolvedValueOnce({ error: new Error('saldo reservado') });
    await expect(cancelarSaldoCarregamento('car-1', 5, 'Ajuste')).rejects.toThrow(
      'saldo reservado'
    );
  });

  it('agenda execução com status agendado', async () => {
    rpcMock.mockResolvedValue({
      data: {
        id: 'exec-1',
        carregamento_id: 'car-1',
        motorista_nome: 'João',
        placa_veiculo: 'ABC1234',
        quantidade_agendada: 30,
        status: 'agendado',
      },
      error: null,
    });
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const syncEq = vi.fn(() => ({ maybeSingle }));
    const syncSelect = vi.fn(() => ({ eq: syncEq }));
    fromMock.mockImplementation((table: string) =>
      table === 'carregamentos' ? { select: syncSelect } : {}
    );

    const result = await createExecucao({
      carregamento_id: 'car-1',
      motorista_nome: 'João',
      placa_veiculo: 'ABC1234',
      quantidade_agendada: 30,
      criado_por: 'user-1',
    });

    expect(result.status).toBe('agendado');
    expect(result.quantidade_agendada).toBe(30);
    expect(rpcMock).toHaveBeenCalledWith('agendar_execucao_carregamento', {
      p_carregamento_id: 'car-1',
      p_motorista_nome: 'João',
      p_motorista_cpf: null,
      p_placa_veiculo: 'ABC1234',
      p_placa_carreta: null,
      p_quantidade: 30,
      p_data_agendamento: null,
      p_observacoes: null,
    });
    expect(syncSelect).toHaveBeenCalledWith('pedido_venda_id');
  });

  it('inicia e conclui execução', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { carregamento_id: 'car-1' },
      error: null,
    });
    const selectEq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq: selectEq }));
    fromMock.mockReturnValue({ select });

    const started = await updateExecucaoStatus('exec-1', 'em_carregamento');
    const done = await concluirExecucao('exec-1', 28);

    expect(started).toBe(true);
    expect(done).toBe(true);
    expect(rpcMock).toHaveBeenNthCalledWith(1, 'transicionar_execucao_carregamento', {
      p_execucao_id: 'exec-1',
      p_acao: 'iniciar',
      p_quantidade_carregada: null,
      p_motivo: null,
    });
    expect(rpcMock).toHaveBeenNthCalledWith(2, 'transicionar_execucao_carregamento', {
      p_execucao_id: 'exec-1',
      p_acao: 'concluir',
      p_quantidade_carregada: 28,
      p_motivo: null,
    });
  });

  it('propaga falha do banco ao exceder o volume liberado', async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error('saldo liberado insuficiente') });

    await expect(
      createExecucao({
        carregamento_id: 'car-1',
        motorista_nome: 'João',
        placa_veiculo: 'ABC1234',
        quantidade_agendada: 99,
      })
    ).rejects.toThrow('saldo liberado insuficiente');
  });
});
