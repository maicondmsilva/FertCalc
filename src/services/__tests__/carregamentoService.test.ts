import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('../supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

import { getQuantidadeCarregadaPorItem } from '../carregamentoService';

describe('carregamentoService', () => {
  beforeEach(() => {
    fromMock.mockReset();
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
});
