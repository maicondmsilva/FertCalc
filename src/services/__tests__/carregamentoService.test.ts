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
  aprovarCotacaoFrete,
  createCarregamento,
  deleteCarregamento,
  getQuantidadeCarregadaPorItem,
  liberarCarregamento,
} from '../carregamentoService';

describe('carregamentoService', () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  it('cria cabeçalho e produtos por uma única operação idempotente', async () => {
    rpcMock.mockResolvedValue({
      data: {
        id: 'car-1',
        numero_carregamento: 'CAR-2026-0001',
        tipo_frete: 'FOB',
        status: 'aguardando_liberacao',
        quantidade_total: 30,
        quantidade_liberada: 0,
        quantidade_carregada: 0,
      },
      error: null,
    });

    const result = await createCarregamento(
      {
        tipo_frete: 'FOB',
        status: 'aguardando_liberacao',
        quantidade_total: 30,
        quantidade_liberada: 0,
        quantidade_carregada: 0,
      },
      [{ produto_nome: 'Produto', quantidade_ton: 30 }],
      'request-1'
    );

    expect(result.numero_carregamento).toBe('CAR-2026-0001');
    expect(rpcMock).toHaveBeenCalledWith('criar_carregamento', {
      p_payload: expect.objectContaining({ quantidade_total: 30 }),
      p_itens: [{ produto_nome: 'Produto', quantidade_ton: 30 }],
      p_request_id: 'request-1',
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('não confirma criação quando a transação falha', async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error('saldo alterado') });
    await expect(
      createCarregamento(
        {
          tipo_frete: 'FOB',
          status: 'aguardando_liberacao',
          quantidade_total: 30,
          quantidade_liberada: 0,
          quantidade_carregada: 0,
        },
        [],
        'request-1'
      )
    ).rejects.toThrow('saldo alterado');
  });

  it('exclui e audita por uma única operação do banco', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    await expect(deleteCarregamento('car-1', 'Duplicidade')).resolves.toBe(true);
    expect(rpcMock).toHaveBeenCalledWith('excluir_carregamento', {
      p_id: 'car-1',
      p_motivo: 'Duplicidade',
    });
  });

  it('carrega o progresso consolidado diretamente dos itens do pedido', async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [{ id: 'item-1', quantidade_carregada: 12.5 }],
      error: null,
    });
    const select = vi.fn(() => ({ eq }));
    fromMock.mockReturnValue({ select });

    await expect(getQuantidadeCarregadaPorItem('pedido-1')).resolves.toEqual({
      'item-1': 12.5,
    });

    expect(fromMock).toHaveBeenCalledWith('pedidos_venda_itens');
    expect(select).toHaveBeenCalledWith('id, quantidade_carregada');
    expect(eq).toHaveBeenCalledWith('pedido_venda_id', 'pedido-1');
  });

  it('aprova a proposta por meio da operação atômica do banco', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await aprovarCotacaoFrete('cotacao-1');

    expect(rpcMock).toHaveBeenCalledWith('aprovar_cotacao_frete', {
      p_cotacao_id: 'cotacao-1',
    });
  });

  it('propaga a falha ao aprovar uma proposta inválida', async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error('proposta expirada') });

    await expect(aprovarCotacaoFrete('cotacao-1')).rejects.toThrow('proposta expirada');
  });

  it('libera parcialmente o carregamento por meio da operação atômica', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await liberarCarregamento('carregamento-1', 'parcial', 12.345);

    expect(rpcMock).toHaveBeenCalledWith('liberar_carregamento', {
      p_carregamento_id: 'carregamento-1',
      p_tipo: 'parcial',
      p_quantidade: 12.345,
    });
  });

  it('não envia quantidade manual na liberação total', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await liberarCarregamento('carregamento-1', 'total');

    expect(rpcMock).toHaveBeenCalledWith('liberar_carregamento', {
      p_carregamento_id: 'carregamento-1',
      p_tipo: 'total',
      p_quantidade: null,
    });
  });

  it('propaga a falha de uma liberação inválida', async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error('saldo insuficiente') });

    await expect(liberarCarregamento('carregamento-1', 'parcial', 99)).rejects.toThrow(
      'saldo insuficiente'
    );
  });
});
