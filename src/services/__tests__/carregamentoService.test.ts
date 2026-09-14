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

import { aprovarCotacaoFrete, getQuantidadeCarregadaPorItem } from '../carregamentoService';

describe('carregamentoService', () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
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
});

