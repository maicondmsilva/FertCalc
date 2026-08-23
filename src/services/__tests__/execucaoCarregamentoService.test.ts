import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('../supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

import {
  concluirExecucao,
  createExecucao,
  updateExecucaoStatus,
} from '../execucaoCarregamentoService';

describe('execucaoCarregamentoService', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('agenda execução com status agendado', async () => {
    const single = vi.fn().mockResolvedValue({
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
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const syncEq = vi.fn(() => ({ maybeSingle }));
    const syncSelect = vi.fn(() => ({ eq: syncEq }));
    fromMock.mockImplementation((table: string) =>
      table === 'carregamentos' ? { select: syncSelect } : { insert }
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
    expect(syncSelect).toHaveBeenCalledWith('pedido_venda_id');
  });

  it('inicia e conclui execução', async () => {
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq: updateEq }));
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { carregamento_id: 'car-1' },
      error: null,
    });
    const selectEq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq: selectEq }));
    fromMock.mockReturnValue({ update, select });

    const started = await updateExecucaoStatus('exec-1', 'em_carregamento');
    const done = await concluirExecucao('exec-1', 28);

    expect(started).toBe(true);
    expect(done).toBe(true);
    expect(update).toHaveBeenCalled();
  });
});
