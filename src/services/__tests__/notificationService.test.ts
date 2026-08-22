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

vi.mock('../db', () => ({
  getManagersOfUser: vi.fn().mockResolvedValue([]),
}));

import { createNotification } from '../notificationService';

describe('notificationService', () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: null, error: null });
  });

  it('envia notificações pela RPC protegida sem inserir diretamente na tabela', async () => {
    await createNotification({
      user_id: '00000000-0000-4000-8000-000000000002',
      type: 'PRICING_CREATED',
      group_type: 'PRICING',
      title: 'Nova precificação',
      message: 'Uma precificação requer análise.',
      action_url: '/calculator?id=pricing-1',
      metadata: { pricingId: '00000000-0000-4000-8000-000000000003' },
    });

    expect(rpcMock).toHaveBeenCalledWith('send_notification', {
      p_user_id: '00000000-0000-4000-8000-000000000002',
      p_type: 'PRICING_CREATED',
      p_group_type: 'PRICING',
      p_title: 'Nova precificação',
      p_message: 'Uma precificação requer análise.',
      p_action_url: '/calculator?id=pricing-1',
      p_data_id: '00000000-0000-4000-8000-000000000003',
      p_metadata: { pricingId: '00000000-0000-4000-8000-000000000003' },
    });
    expect(fromMock).not.toHaveBeenCalled();
  });
});
