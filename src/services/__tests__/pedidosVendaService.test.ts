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

import { createPedidoVenda } from '../pedidosVendaService';

const selectById = (row: Record<string, unknown>) => ({
  select: () => ({
    eq: () => ({
      maybeSingle: () => Promise.resolve({ data: row, error: null }),
    }),
  }),
});

describe('createPedidoVenda', () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  it('cria pedido e produtos numa única chamada ao banco', async () => {
    rpcMock.mockResolvedValue({ data: 'pedido-1', error: null });
    fromMock.mockReturnValue(
      selectById({ id: 'pedido-1', numero_pedido: '100', emitente: 1, status: 'pendente' })
    );

    const pedido = await createPedidoVenda(
      { numero_pedido: '100', emitente: 1, precificacao_id: 'prec-1' },
      [
        { produto_nome: '05-25-15', quantidade_ton: 30 },
        { produto_nome: '20-00-20', quantidade_ton: 12.5, embalagem: 'Big bag' },
      ]
    );

    expect(rpcMock).toHaveBeenCalledTimes(1);
    const [name, args] = rpcMock.mock.calls[0];
    expect(name).toBe('criar_pedido_venda');
    expect(args.p_itens).toHaveLength(2);
    expect(args.p_itens[1]).toMatchObject({ produto_nome: '20-00-20', quantidade_ton: 12.5 });
    // Saldo, status e cancelamentos são definidos pelo banco, não pela tela.
    expect(args.p_pedido).not.toHaveProperty('quantidade_cancelada_definitiva');
    expect(args.p_pedido).not.toHaveProperty('status');
    expect(pedido.id).toBe('pedido-1');
  });

  it('não envia pedido sem produtos', async () => {
    await expect(createPedidoVenda({ numero_pedido: '100' }, [])).rejects.toThrow(
      'Informe ao menos um produto'
    );
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('traduz pedido duplicado', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: '23505', message: 'dup' } });
    await expect(
      createPedidoVenda({ numero_pedido: '100' }, [{ produto_nome: 'X', quantidade_ton: 1 }])
    ).rejects.toThrow('Pedido duplicado');
  });
});
