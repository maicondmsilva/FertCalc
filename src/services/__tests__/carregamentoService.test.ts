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

  it('desambigua a relação usada para carregar o progresso dos itens', async () => {
    const gt = vi.fn().mockResolvedValue({ data: [], error: null });
    const eq = vi.fn(() => ({ gt }));
    const select = vi.fn(() => ({ eq }));
    fromMock.mockReturnValue({ select });

    await expect(getQuantidadeCarregadaPorItem('pedido-1')).resolves.toEqual({});

    expect(fromMock).toHaveBeenCalledWith('carregamentos');
    expect(select).toHaveBeenCalledWith(
      'quantidade_carregada, carregamento_itens!carregamento_itens_carregamento_id_fkey(pedido_venda_item_id, quantidade_ton)'
    );
    expect(eq).toHaveBeenCalledWith('pedido_venda_id', 'pedido-1');
    expect(gt).toHaveBeenCalledWith('quantidade_carregada', 0);
  });
});
