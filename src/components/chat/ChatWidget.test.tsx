import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../../types';

const mocks = vi.hoisted(() => ({
  getOrCreateDirectChat: vi.fn(),
  getChatMessageReceipts: vi.fn(),
  getChatProfile: vi.fn(),
  createGroupChat: vi.fn(),
  deleteChatMessage: vi.fn(),
  editChatMessage: vi.fn(),
  listChatContacts: vi.fn(),
  listChatContactStatuses: vi.fn(),
  listChatConversations: vi.fn(),
  listChatMessages: vi.fn(),
  listChatMessagesAfter: vi.fn(),
  listChatMessageReactions: vi.fn(),
  markChatRead: vi.fn(),
  recordChatOperationMetric: vi.fn(),
  sendChatMessage: vi.fn(),
  subscribeToChatMessages: vi.fn(),
  subscribeToChatReactions: vi.fn(),
  subscribeToChatPresence: vi.fn(),
  subscribeToChatReads: vi.fn(),
  updateOwnChatProfile: vi.fn(),
  toggleChatMessageReaction: vi.fn(),
  uploadOwnChatAvatar: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('../../services/chatService', () => ({
  getOrCreateDirectChat: mocks.getOrCreateDirectChat,
  getChatMessageReceipts: mocks.getChatMessageReceipts,
  getChatProfile: mocks.getChatProfile,
  createGroupChat: mocks.createGroupChat,
  deleteChatMessage: mocks.deleteChatMessage,
  editChatMessage: mocks.editChatMessage,
  listChatContacts: mocks.listChatContacts,
  listChatContactStatuses: mocks.listChatContactStatuses,
  listChatConversations: mocks.listChatConversations,
  listChatMessages: mocks.listChatMessages,
  listChatMessagesAfter: mocks.listChatMessagesAfter,
  listChatMessageReactions: mocks.listChatMessageReactions,
  markChatRead: mocks.markChatRead,
  recordChatOperationMetric: mocks.recordChatOperationMetric,
  sendChatMessage: mocks.sendChatMessage,
  subscribeToChatMessages: mocks.subscribeToChatMessages,
  subscribeToChatReactions: mocks.subscribeToChatReactions,
  subscribeToChatPresence: mocks.subscribeToChatPresence,
  subscribeToChatReads: mocks.subscribeToChatReads,
  updateOwnChatProfile: mocks.updateOwnChatProfile,
  toggleChatMessageReaction: mocks.toggleChatMessageReaction,
  uploadOwnChatAvatar: mocks.uploadOwnChatAvatar,
}));

vi.mock('../Toast', () => ({
  useToast: () => ({ showError: mocks.showError }),
}));

import ChatWidget from './ChatWidget';

const currentUser = { id: 'user-1', name: 'Usuário', role: 'user' } as User;
const conversation = {
  conversationId: 'conversation-1',
  contactId: 'user-2',
  contactName: 'Maria',
  contactNickname: 'maria',
  contactRole: 'user',
  lastMessageBody: 'Mensagem anterior',
  lastMessageAt: '2026-09-23T10:00:00.000Z',
  unreadCount: 1,
};
const message = {
  id: 'message-1',
  conversationId: 'conversation-1',
  organizationId: 'organization-1',
  senderId: 'user-2',
  clientMessageId: 'client-1',
  body: 'Mensagem anterior',
  createdAt: '2026-09-23T10:00:00.000Z',
};

let onMessage: ((value: typeof message) => void) | undefined;
let onStatus: ((value: string) => void) | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  onMessage = undefined;
  onStatus = undefined;
  mocks.listChatConversations.mockResolvedValue([conversation]);
  mocks.listChatMessages.mockResolvedValue([message]);
  mocks.listChatMessagesAfter.mockResolvedValue([]);
  mocks.listChatMessageReactions.mockResolvedValue([]);
  mocks.listChatContacts.mockResolvedValue([]);
  mocks.listChatContactStatuses.mockResolvedValue({ statuses: {}, avatarUrls: {} });
  mocks.markChatRead.mockResolvedValue(undefined);
  mocks.deleteChatMessage.mockResolvedValue(undefined);
  mocks.editChatMessage.mockResolvedValue(undefined);
  mocks.getChatMessageReceipts.mockResolvedValue([]);
  mocks.getChatProfile.mockResolvedValue(null);
  mocks.subscribeToChatReads.mockReturnValue(vi.fn());
  mocks.subscribeToChatReactions.mockReturnValue(vi.fn());
  mocks.subscribeToChatPresence.mockReturnValue(vi.fn());
  mocks.updateOwnChatProfile.mockResolvedValue(undefined);
  mocks.toggleChatMessageReaction.mockResolvedValue(true);
  mocks.recordChatOperationMetric.mockResolvedValue(undefined);
  mocks.subscribeToChatMessages.mockImplementation(
    (_userId: string, messageCallback: typeof onMessage, statusCallback: typeof onStatus) => {
      onMessage = messageCallback;
      onStatus = statusCallback;
      return vi.fn();
    }
  );
});

afterEach(cleanup);

const openConversation = async () => {
  render(<ChatWidget currentUser={currentUser} />);
  fireEvent.click(screen.getByLabelText('Abrir chat interno'));
  await waitFor(() => expect(screen.getByText('Maria')).toBeDefined());
  fireEvent.click(screen.getByText('Maria'));
  await waitFor(() => expect(screen.getByText('Mensagem anterior')).toBeDefined());
};

describe('ChatWidget resiliente', () => {
  it('expõe diálogo acessível, fecha com Escape e devolve o foco ao acionador', async () => {
    render(<ChatWidget currentUser={currentUser} />);
    const trigger = screen.getByLabelText('Abrir chat interno');
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'Chat interno' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('recupera mensagens posteriores ao cursor quando o tempo real reconecta', async () => {
    await openConversation();

    act(() => onStatus?.('SUBSCRIBED'));

    await waitFor(() =>
      expect(mocks.listChatMessagesAfter).toHaveBeenCalledWith(
        'conversation-1',
        { createdAt: message.createdAt, id: message.id },
        100
      )
    );
    expect(screen.getByText('Em tempo real')).toBeDefined();
  });

  it('não marca mensagem como lida quando o painel está fechado', async () => {
    await openConversation();
    mocks.markChatRead.mockClear();
    fireEvent.click(screen.getAllByLabelText('Fechar chat')[0]);

    act(() =>
      onMessage?.({
        ...message,
        id: 'message-2',
        clientMessageId: 'client-2',
        body: 'Mensagem com painel fechado',
        createdAt: '2026-09-23T10:01:00.000Z',
      })
    );

    await waitFor(() => expect(mocks.listChatConversations).toHaveBeenCalled());
    expect(mocks.markChatRead).not.toHaveBeenCalled();
  });

  it('permite editar uma mensagem própria e mostra o marcador editada', async () => {
    const ownMessage = {
      ...message,
      senderId: currentUser.id,
      createdAt: new Date().toISOString(),
    };
    mocks.listChatMessages.mockResolvedValue([ownMessage]);
    mocks.editChatMessage.mockResolvedValue({
      ...ownMessage,
      body: 'Texto corrigido',
      editedAt: '2026-09-23T10:01:00.000Z',
    });
    await openConversation();

    fireEvent.click(screen.getByLabelText('Editar mensagem'));
    fireEvent.change(screen.getByLabelText('Editar mensagem'), {
      target: { value: 'Texto corrigido' },
    });
    fireEvent.click(screen.getByText('Salvar'));

    await waitFor(() =>
      expect(mocks.editChatMessage).toHaveBeenCalledWith('message-1', 'Texto corrigido')
    );
    expect(await screen.findByText('Texto corrigido')).toBeDefined();
    expect(screen.getByText('editada')).toBeDefined();
  });

  it('mantém o espaço da mensagem depois da exclusão', async () => {
    const ownMessage = { ...message, senderId: currentUser.id };
    mocks.listChatMessages.mockResolvedValue([ownMessage]);
    mocks.deleteChatMessage.mockResolvedValue({
      ...ownMessage,
      body: '',
      deletedAt: '2026-09-23T10:01:00.000Z',
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await openConversation();

    fireEvent.click(screen.getByLabelText('Excluir mensagem'));

    await waitFor(() => expect(mocks.deleteChatMessage).toHaveBeenCalledWith('message-1'));
    expect(await screen.findByText('Mensagem excluída')).toBeDefined();
  });

  it('expande o campo de digitação e oferece emojis por categoria', async () => {
    await openConversation();
    const composer = screen.getByLabelText('Mensagem do chat') as HTMLTextAreaElement;
    Object.defineProperty(composer, 'scrollHeight', { configurable: true, value: 120 });

    fireEvent.change(composer, { target: { value: 'Linha 1\nLinha 2\nLinha 3' } });
    await waitFor(() => expect(composer.style.height).toBe('120px'));

    fireEvent.click(screen.getByLabelText('Escolher emoji'));
    fireEvent.click(screen.getByLabelText('Adicionar 😃'));
    expect(composer.value).toContain('😃');
  });

  it('permite reagir e atualiza os totais da conversa', async () => {
    mocks.listChatMessageReactions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { messageId: 'message-1', emoji: '👍', count: 1, reactedByMe: true },
      ]);
    await openConversation();

    fireEvent.click(screen.getByLabelText('Reagir à mensagem'));
    fireEvent.click(screen.getByLabelText('Reagir com 👍'));

    await waitFor(() =>
      expect(mocks.toggleChatMessageReaction).toHaveBeenCalledWith('message-1', '👍')
    );
    expect(await screen.findByText('👍 1')).toBeDefined();
  });
});
