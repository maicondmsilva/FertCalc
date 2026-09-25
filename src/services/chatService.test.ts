import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, channel, removeChannel, on, subscribe, track, untrack, presenceState, send } =
  vi.hoisted(() => ({
    rpc: vi.fn(),
    channel: vi.fn(),
    removeChannel: vi.fn(),
    on: vi.fn(),
    subscribe: vi.fn(),
    track: vi.fn(),
    untrack: vi.fn(),
    presenceState: vi.fn(),
    send: vi.fn(),
  }));

vi.mock('./supabase', () => ({
  supabase: { rpc, channel, removeChannel },
}));

import {
  deleteChatMessage,
  deleteChatConversation,
  editChatMessage,
  listChatMessageReactions,
  listChatGroupMembers,
  listChatConversations,
  listChatMessagesAfter,
  sendChatMessage,
  subscribeToChatPresence,
  subscribeToChatMessages,
  subscribeToChatTyping,
  toggleChatMessageReaction,
  updateChatGroupMembers,
  updateChatPreferences,
  validateChatAttachmentFiles,
} from './chatService';

beforeEach(() => {
  vi.clearAllMocks();
  on.mockReturnValue({ on, subscribe });
  channel.mockReturnValue({ on, subscribe, track, untrack, presenceState, send });
  subscribe.mockReturnValue({ topic: 'chat' });
  track.mockResolvedValue('ok');
  untrack.mockResolvedValue('ok');
  presenceState.mockReturnValue({});
  removeChannel.mockResolvedValue('ok');
  send.mockResolvedValue('ok');
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
    expect(rpc).toHaveBeenCalledWith('list_chat_conversations', {
      p_limit: 50,
      p_archived: false,
    });
  });

  it('atualiza preferências individuais da conversa', async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await updateChatPreferences('conversation-1', {
      archived: true,
      mutedUntil: '2026-09-25T18:00:00.000Z',
    });

    expect(rpc).toHaveBeenCalledWith('update_chat_preferences', {
      p_conversation_id: 'conversation-1',
      p_archived: true,
      p_muted_until: '2026-09-25T18:00:00.000Z',
    });
  });

  it('envia a preferência de fixação sem alterar os demais campos', async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await updateChatPreferences('conversation-1', {
      archived: false,
      mutedUntil: null,
      pinned: true,
    });

    expect(rpc).toHaveBeenCalledWith('update_chat_preferences', {
      p_conversation_id: 'conversation-1',
      p_archived: false,
      p_muted_until: null,
      p_pinned: true,
    });
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

  it('envia uma resposta vinculada e normaliza a prévia citada', async () => {
    rpc.mockResolvedValue({
      data: {
        id: 'message-2',
        conversation_id: 'conversation-1',
        organization_id: 'organization-1',
        sender_id: 'user-1',
        client_message_id: 'client-2',
        body: 'Resposta',
        created_at: '2026-09-23T10:01:00.000Z',
        reply_to_message_id: 'message-1',
        reply_preview_body: 'Mensagem original',
        reply_preview_sender_name: 'Maria',
      },
      error: null,
    });

    const result = await sendChatMessage('conversation-1', 'Resposta', 'client-2', 'message-1');

    expect(rpc).toHaveBeenCalledWith('send_chat_reply', {
      p_conversation_id: 'conversation-1',
      p_body: 'Resposta',
      p_client_message_id: 'client-2',
      p_reply_to_message_id: 'message-1',
    });
    expect(result).toEqual(
      expect.objectContaining({
        replyToMessageId: 'message-1',
        replyPreviewBody: 'Mensagem original',
        replyPreviewSenderName: 'Maria',
      })
    );
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

  it('lista e atualiza os participantes do grupo', async () => {
    rpc
      .mockResolvedValueOnce({
        data: [
          {
            user_id: 'user-1',
            name: 'Maria',
            nickname: 'maria',
            role: 'user',
            participant_role: 'owner',
            can_manage: true,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });

    await expect(listChatGroupMembers('conversation-1')).resolves.toEqual([
      expect.objectContaining({ id: 'user-1', participantRole: 'owner', canManage: true }),
    ]);
    await expect(
      updateChatGroupMembers('conversation-1', ['user-2', 'user-3'])
    ).resolves.toBeUndefined();
    expect(rpc).toHaveBeenNthCalledWith(2, 'update_chat_group_members', {
      p_conversation_id: 'conversation-1',
      p_member_ids: ['user-2', 'user-3'],
    });
  });

  it('valida quantidade, tamanho e tipo dos anexos', () => {
    expect(() => validateChatAttachmentFiles([])).toThrow('Selecione de 1 a 5 arquivos.');
    expect(() =>
      validateChatAttachmentFiles([
        new File(['conteúdo'], 'arquivo.exe', { type: 'application/x-msdownload' }),
      ])
    ).toThrow('tipo de arquivo não permitido');
    expect(() =>
      validateChatAttachmentFiles([
        new File(['conteúdo'], 'arquivo.pdf', { type: 'application/pdf' }),
      ])
    ).not.toThrow();
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

  it('exclui a conversa somente para o usuário atual', async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await expect(deleteChatConversation('conversation-1')).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith('delete_chat_conversation', {
      p_conversation_id: 'conversation-1',
    });
  });

  it('identifica presença pelo usuário publicado e pela chave do canal', async () => {
    const callback = vi.fn();
    const statusCallback = vi.fn();
    presenceState.mockReturnValue({
      'socket-key': [{ user_id: 'user-2', online_at: '2026-09-23T10:00:00.000Z' }],
    });

    const unsubscribe = subscribeToChatPresence(
      'organization-1',
      'user-1',
      callback,
      statusCallback
    );
    const syncCallback = on.mock.calls[0][2];
    const subscriptionCallback = subscribe.mock.calls[0][0];

    syncCallback();
    expect(callback).toHaveBeenCalledWith(new Set(['socket-key', 'user-2']));

    await subscriptionCallback('SUBSCRIBED');
    expect(track).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', online_at: expect.any(String) })
    );
    expect(statusCallback).toHaveBeenCalledWith('SUBSCRIBED');

    unsubscribe();
    expect(untrack).toHaveBeenCalled();
  });

  it('publica e recebe indicador de digitação no canal privado da empresa', async () => {
    const callback = vi.fn();
    const controller = subscribeToChatTyping('organization-1', 'user-1', callback);
    const broadcastCallback = on.mock.calls[0][2];
    const subscriptionCallback = subscribe.mock.calls[0][0];

    subscriptionCallback('SUBSCRIBED');
    broadcastCallback({
      payload: { conversationId: 'conversation-1', userId: 'user-2', isTyping: true },
    });
    expect(callback).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      userId: 'user-2',
      isTyping: true,
    });

    await controller.sendTyping('conversation-1', true);
    expect(send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'typing',
      payload: { conversationId: 'conversation-1', userId: 'user-1', isTyping: true },
    });
    controller.unsubscribe();
    expect(removeChannel).toHaveBeenCalled();
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
