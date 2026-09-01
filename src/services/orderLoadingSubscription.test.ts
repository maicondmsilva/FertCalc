import { beforeEach, describe, expect, it, vi } from 'vitest';

const { removeChannel, subscribe, registeredTables, channel } = vi.hoisted(() => {
  const registeredTables: string[] = [];
  const removeChannel = vi.fn();
  const subscribe = vi.fn();
  const channel: {
    on: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
  } = {
    on: vi.fn(),
    subscribe,
  };
  channel.on.mockImplementation((_event: string, filter: { table: string }) => {
    registeredTables.push(filter.table);
    return channel;
  });
  subscribe.mockReturnValue(channel);
  return { removeChannel, subscribe, registeredTables, channel };
});

vi.mock('./supabase', () => ({
  supabase: {
    channel: vi.fn(() => channel),
    removeChannel,
  },
}));

import { subscribeToOrderLoadingChanges } from './orderLoadingSubscription';

describe('order and loading realtime subscription', () => {
  beforeEach(() => {
    registeredTables.length = 0;
    removeChannel.mockClear();
    subscribe.mockClear();
  });

  it('subscribes to every table that can change the loading workflow', () => {
    const unsubscribe = subscribeToOrderLoadingChanges(vi.fn());

    expect(registeredTables).toEqual([
      'pedidos_venda',
      'pedidos_venda_itens',
      'carregamentos',
      'carregamento_itens',
      'carregamento_execucoes',
      'cotacoes_frete',
      'cotacoes_solicitadas',
    ]);
    expect(subscribe).toHaveBeenCalledOnce();

    unsubscribe();
    expect(removeChannel).toHaveBeenCalledWith(channel);
  });
});
