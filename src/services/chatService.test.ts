import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, channel, removeChannel, on, subscribe } = vi.hoisted(() => ({
  rpc: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
  on: vi.fn(),
  subscribe: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: { rpc, channel, removeChannel },
}));

import {
  deleteChatMessage,
  editChatMessage,
  listChatMessageReactions,
  listChatConversations,
  listChatMessagesAfter,
  sendChatMessage,
  subscribeToChatMessages,
  toggleChatMessageReaction,
} from './chatService';

beforeEach(() => {
  vi.clearAllMocks();
  on.mockReturnValue({ on, subscribe });
  channel.mockReturnValue({ on });
  subscribe.mockReturnValue({ topic: 'chat' });
  removeChannel.mockResolvedValue('ok');
});

describe('chatService', () => {
  it('normaliza a lista de conversas e o contador de não lidas', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          conversation_id: 'conversation-1',
          contact_id: 'user-2',
          contact_name: 'Maria',
          contact_nickname: 'maria',
          contact_role: 'VENDEDOR',
          last_message_body: 'Olá',
          last_message_sender_id: 'user-2',
          last_message_at: '2026-09-23T10:00:00.000Z',
          unread_count: '2',
        },
      ],
      error: null,
    });

    await expect(listChatConversations()).resolves.toEqual([
      expect.objectContaining({
        conversationId: 'conversation-1',
        contactName: 'Maria',
        unreadCount: 2,
      }),
    ]);
    expect(rpc).toHaveBeenCalledWith('list_chat_conversations', { p_limit: 50 });
  });

  it('envia a chave idempotente e normaliza a mensagem salva', async () => {
    rpc.mockResolvedValue({
      data: {
        id: 'message-1',
        conversation_id: 'conversation-1',
        organization_id: 'organization-1',
        sender_id: 'user-1',
        client_message_id: 'client-1',
        body: 'Mensagem',
        created_at: '2026-09-23T10:00:00.000Z',
      },
      error: null,
    });

    const result = await sendChatMessage('conversation-1', 'Mensagem', 'client-1');

    expect(rpc).toHaveBeenCalledWith('send_chat_message', {
      p_conversation_id: 'conversation-1',
      p_body: 'Mensagem',
      p_client_message_id: 'client-1',
    });
    expect(result).toEqual(expect.objectContaining({ id: 'message-1', body: 'Mensagem' }));
  });

  it('recupera mensagens posteriores ao último cursor conhecido', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          id: 'message-2',
          conversation_id: 'conversation-1',
          organization_id: 'organization-1',
          sender_id: 'user-2',
          client_message_id: 'client-2',
          body: 'Mensagem recuperada',
          created_at: '2026-09-23T10:01:00.000Z',
        },
      ],
      error: null,
    });

    const result = await listChatMessagesAfter(
      'conversation-1',
      { createdAt: '2026-09-23T10:00:00.000Z', id: 'message-1' },
      100
    );

    expect(rpc).toHaveBeenCalledWith('get_chat_messages_after', {
      p_conversation_id: 'conversation-1',
      p_after_created_at: '2026-09-23T10:00:00.000Z',
      p_after_id: 'message-1',
      p_limit: 100,
    });
    expect(result[0]).toEqual(
      expect.objectContaining({ id: 'message-2', body: 'Mensagem recuperada' })
    );
  });

  it('lista e alterna reações de mensagens', async () => {
    rpc
      .mockResolvedValueOnce({
        data: [
          {
            message_id: 'message-1',
            emoji: '👍',
            reaction_count: '2',
            reacted_by_me: true,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: false, error: null });

    await expect(listChatMessageReactions('conversation-1')).resolves.toEqual([
      { messageId: 'message-1', emoji: '👍', count: 2, reactedByMe: true },
    ]);
    await expect(toggleChatMessageReaction('message-1', '👍')).resolves.toBe(false);
    expect(rpc).toHaveBeenNthCalledWith(2, 'toggle_chat_message_reaction', {
      p_message_id: 'message-1',
      p_emoji: '👍',
    });
  });

  it('edita e exclui mensagens pelas operações protegidas', async () => {
    const base = {
      id: 'message-1',
      conversation_id: 'conversation-1',
      organization_id: 'organization-1',
      sender_id: 'user-1',
      client_message_id: 'client-1',
      body: 'Mensagem editada',
      created_at: '2026-09-23T10:00:00.000Z',
      edited_at: '2026-09-23T10:01:00.000Z',
      deleted_at: null,
    };
    rpc.mockResolvedValueOnce({ data: base, error: null }).mockResolvedValueOnce({
      data: { ...base, body: '', deleted_at: '2026-09-23T10:02:00.000Z' },
      error: null,
    });

    await expect(editChatMessage('message-1', 'Mensagem editada')).resolves.toEqual(
      expect.objectContaining({ body: 'Mensagem editada', editedAt: base.edited_at })
    );
    expect(rpc).toHaveBeenNthCalledWith(1, 'edit_chat_message', {
      p_message_id: 'message-1',
      p_body: 'Mensagem editada',
    });

    await expect(deleteChatMessage('message-1')).resolves.toEqual(
      expect.objectContaining({ body: '', deletedAt: '2026-09-23T10:02:00.000Z' })
    );
    expect(rpc).toHaveBeenNthCalledWith(2, 'delete_chat_message', {
      p_message_id: 'message-1',
    });
  });

  it('normaliza mensagens recebidas em tempo real e remove o canal ao sair', () => {
    const callback = vi.fn();
    const unsubscribe = subscribeToChatMessages('user-1', callback);
    const insertCallback = on.mock.calls[0][2];
    const updateCallback = on.mock.calls[1][2];

    insertCallback({
      new: {
        id: 'message-2',
        conversation_id: 'conversation-1',
        organization_id: 'organization-1',
        sender_id: 'user-2',
        client_message_id: 'client-2',
        body: 'Nova mensagem',
        created_at: '2026-09-23T10:01:00.000Z',
      },
    });

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'message-2', conversationId: 'conversation-1' })
    );
    updateCallback({
      new: {
        id: 'message-2',
        conversation_id: 'conversation-1',
        organization_id: 'organization-1',
        sender_id: 'user-2',
        client_message_id: 'client-2',
        body: '',
        created_at: '2026-09-23T10:01:00.000Z',
        deleted_at: '2026-09-23T10:02:00.000Z',
      },
    });
    expect(callback).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'message-2', body: '', deletedAt: expect.any(String) })
    );
    unsubscribe();
    expect(removeChannel).toHaveBeenCalledWith({ topic: 'chat' });
  });
});
