import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCheck,
  Eye,
  Loader2,
  MessageCircle,
  Plus,
  Search,
  Send,
  Smile,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import type { User } from '../../types';
import type {
  ChatContact,
  ChatConversation,
  ChatMessage,
  ChatMessageReceipt,
  ChatPresenceStatus,
  ChatProfile,
} from '../../types/chat.types';
import {
  createGroupChat,
  getChatMessageReceipts,
  getChatProfile,
  getOrCreateDirectChat,
  listChatContacts,
  listChatContactStatuses,
  listChatConversations,
  listChatMessages,
  listChatMessagesAfter,
  markChatRead,
  recordChatOperationMetric,
  sendChatMessage,
  subscribeToChatPresence,
  subscribeToChatReads,
  subscribeToChatMessages,
  updateOwnChatProfile,
} from '../../services/chatService';
import { useToast } from '../Toast';

interface ChatWidgetProps {
  currentUser: User;
}

const formatChatTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    : '';

const mergeMessages = (current: ChatMessage[], incoming: ChatMessage[]) => {
  const byId = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => byId.set(message.id, message));
  return [...byId.values()].sort(
    (first, second) =>
      first.createdAt.localeCompare(second.createdAt) || first.id.localeCompare(second.id)
  );
};

export default function ChatWidget({ currentUser }: ChatWidgetProps) {
  const { showError } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [contactStatuses, setContactStatuses] = useState<Record<string, ChatPresenceStatus>>({});
  const [showEmojis, setShowEmojis] = useState(false);
  const [receipts, setReceipts] = useState<Record<string, ChatMessageReceipt>>({});
  const [profile, setProfile] = useState<ChatProfile | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [ownStatus, setOwnStatus] = useState<ChatPresenceStatus>('available');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'recovering'>(
    'connecting'
  );
  const sendingRef = useRef(false);
  const recoveringRef = useRef(false);
  const isOpenRef = useRef(false);
  const selectedRef = useRef<ChatConversation | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const endRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  const unreadCount = useMemo(
    () => conversations.reduce((total, item) => total + item.unreadCount, 0),
    [conversations]
  );

  const avatarRing = (userId?: string | null) => {
    const status = userId ? contactStatuses[userId] : undefined;
    if (status === 'do_not_disturb' || status === 'busy') return 'ring-2 ring-red-500';
    if (status === 'away') return 'ring-2 ring-amber-400';
    if (userId && onlineUserIds.has(userId)) return 'ring-2 ring-emerald-500';
    return 'ring-2 ring-stone-300';
  };

  const refreshConversations = useCallback(async () => {
    try {
      const rows = await listChatConversations();
      setConversations(rows);
      setSelected((current) => {
        if (!current) return current;
        return rows.find((item) => item.conversationId === current.conversationId) ?? current;
      });
    } catch (error) {
      console.error('[Chat] Falha ao carregar conversas:', error);
    } finally {
      setLoadingList(false);
    }
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  const reconcileSelectedConversation = useCallback(async () => {
    const conversation = selectedRef.current;
    const latestKnown = messagesRef.current.at(-1);
    if (!conversation || !latestKnown || recoveringRef.current) return;

    recoveringRef.current = true;
    setRealtimeStatus('recovering');
    const startedAt = Date.now();
    try {
      let cursor = { createdAt: latestKnown.createdAt, id: latestKnown.id };
      const recovered: ChatMessage[] = [];

      for (let page = 0; page < 10; page += 1) {
        const rows = await listChatMessagesAfter(conversation.conversationId, cursor, 100);
        recovered.push(...rows);
        if (rows.length < 100) break;
        const last = rows.at(-1);
        if (!last) break;
        cursor = { createdAt: last.createdAt, id: last.id };
      }

      if (recovered.length > 0) {
        setMessages((current) => mergeMessages(current, recovered));
        if (isOpenRef.current) await markChatRead(conversation.conversationId);
      }
      await refreshConversations();
      setRealtimeStatus('connected');
      void recordChatOperationMetric('message_recovery', 'success', Date.now() - startedAt, {
        recovered_count: recovered.length,
      }).catch((metricError) =>
        console.error('[Chat] Falha ao registrar métrica de recuperação:', metricError)
      );
    } catch (error) {
      console.error('[Chat] Falha ao reconciliar mensagens:', error);
      setRealtimeStatus('recovering');
      void recordChatOperationMetric('message_recovery', 'error', Date.now() - startedAt).catch(
        (metricError) =>
          console.error('[Chat] Falha ao registrar métrica de recuperação:', metricError)
      );
    } finally {
      recoveringRef.current = false;
    }
  }, [refreshConversations]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    isOpenRef.current = isOpen;
    if (isOpen) window.setTimeout(() => panelRef.current?.focus(), 0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeChat();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [closeChat, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: Event) => {
      if (window.innerWidth < 640) return;
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) closeChat();
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [closeChat, isOpen]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!currentUser.organizationId) return;
    return subscribeToChatPresence(currentUser.organizationId, currentUser.id, setOnlineUserIds);
  }, [currentUser.id, currentUser.organizationId]);

  useEffect(() => {
    void listChatContactStatuses()
      .then(setContactStatuses)
      .catch((error) => console.error('[Chat] Falha ao carregar status dos contatos:', error));
  }, []);

  useEffect(() => {
    void getChatProfile(currentUser.id)
      .then((result) => {
        if (result) setOwnStatus(result.chatStatus);
      })
      .catch((error) => console.error('[Chat] Falha ao carregar o próprio status:', error));
  }, [currentUser.id]);

  const refreshReceipts = useCallback(async (conversationId: string) => {
    try {
      const rows = await getChatMessageReceipts(conversationId);
      setReceipts(Object.fromEntries(rows.map((receipt) => [receipt.messageId, receipt])));
    } catch (error) {
      console.error('[Chat] Falha ao atualizar recibos de leitura:', error);
    }
  }, []);

  useEffect(
    () =>
      subscribeToChatReads(() => {
        const conversationId = selectedRef.current?.conversationId;
        if (conversationId) void refreshReceipts(conversationId);
      }),
    [refreshReceipts]
  );

  useEffect(() => {
    void refreshConversations();
    return subscribeToChatMessages(
      currentUser.id,
      (message) => {
        if (selectedRef.current?.conversationId === message.conversationId) {
          setMessages((current) => mergeMessages(current, [message]));
          if (message.senderId !== currentUser.id && isOpenRef.current) {
            void markChatRead(message.conversationId).then(refreshConversations);
          } else {
            void refreshConversations();
          }
        } else {
          void refreshConversations();
        }
      },
      (status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
          void recordChatOperationMetric('realtime_connection', 'success').catch((metricError) =>
            console.error('[Chat] Falha ao registrar métrica do tempo real:', metricError)
          );
          void refreshConversations();
          void reconcileSelectedConversation();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setRealtimeStatus('recovering');
          void recordChatOperationMetric('realtime_connection', 'error', undefined, {
            status,
          }).catch((metricError) =>
            console.error('[Chat] Falha ao registrar métrica do tempo real:', metricError)
          );
        }
      }
    );
  }, [currentUser.id, reconcileSelectedConversation, refreshConversations]);

  useEffect(() => {
    const recover = () => {
      void refreshConversations();
      void reconcileSelectedConversation();
    };
    const recoverWhenVisible = () => {
      if (document.visibilityState === 'visible') recover();
    };

    window.addEventListener('online', recover);
    window.addEventListener('focus', recover);
    document.addEventListener('visibilitychange', recoverWhenVisible);
    return () => {
      window.removeEventListener('online', recover);
      window.removeEventListener('focus', recover);
      document.removeEventListener('visibilitychange', recoverWhenVisible);
    };
  }, [reconcileSelectedConversation, refreshConversations]);

  useEffect(() => {
    if (!isOpen || !showContacts) return;
    const timeout = window.setTimeout(() => {
      void listChatContacts(search)
        .then(setContacts)
        .catch((error) => {
          console.error('[Chat] Falha ao buscar contatos:', error);
          showError('Não foi possível buscar os usuários do chat.');
        });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [isOpen, search, showContacts, showError]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const openConversation = async (conversation: ChatConversation) => {
    setSelected(conversation);
    selectedRef.current = conversation;
    setMessages([]);
    messagesRef.current = [];
    setShowContacts(false);
    setLoadingMessages(true);
    try {
      const rows = await listChatMessages(conversation.conversationId);
      setMessages((current) => mergeMessages(current, [...rows].reverse()));
      setHasOlder(rows.length === 50);
      await markChatRead(conversation.conversationId);
      await refreshReceipts(conversation.conversationId);
      await refreshConversations();
    } catch (error) {
      console.error('[Chat] Falha ao abrir conversa:', error);
      showError('Não foi possível carregar esta conversa.');
    } finally {
      setLoadingMessages(false);
    }
  };

  const startConversation = async (contact: ChatContact) => {
    try {
      const conversationId = await getOrCreateDirectChat(contact.id);
      const conversation: ChatConversation = {
        conversationId,
        conversationType: 'direct',
        conversationTitle: null,
        contactId: contact.id,
        contactName: contact.name,
        contactNickname: contact.nickname,
        contactRole: contact.role,
        memberCount: 2,
        unreadCount: 0,
      };
      await refreshConversations();
      await openConversation(conversation);
    } catch (error) {
      console.error('[Chat] Falha ao iniciar conversa:', error);
      showError('Não foi possível iniciar a conversa.');
    }
  };

  const handleCreateGroup = async () => {
    if (groupName.trim().length < 2 || groupMembers.length === 0) return;
    try {
      const conversationId = await createGroupChat(groupName.trim(), groupMembers);
      const conversation: ChatConversation = {
        conversationId,
        conversationType: 'group',
        conversationTitle: groupName.trim(),
        contactId: null,
        contactName: groupName.trim(),
        contactRole: 'group',
        memberCount: groupMembers.length + 1,
        unreadCount: 0,
      };
      setCreatingGroup(false);
      setGroupName('');
      setGroupMembers([]);
      await refreshConversations();
      await openConversation(conversation);
    } catch (error) {
      console.error('[Chat] Falha ao criar grupo:', error);
      showError('Não foi possível criar o grupo. Confira os participantes.');
    }
  };

  const openProfile = async (userId: string) => {
    try {
      const result = await getChatProfile(userId);
      setProfile(result);
      setShowProfile(Boolean(result));
    } catch (error) {
      console.error('[Chat] Falha ao abrir perfil:', error);
      showError('Não foi possível carregar o perfil.');
    }
  };

  const changeOwnStatus = async (status: ChatPresenceStatus) => {
    setOwnStatus(status);
    try {
      await updateOwnChatProfile({ status });
    } catch {
      setOwnStatus('available');
      showError('Não foi possível atualizar seu status.');
    }
  };

  const loadOlder = async () => {
    const oldest = messages[0];
    if (!selected || !oldest || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const rows = await listChatMessages(
        selected.conversationId,
        { createdAt: oldest.createdAt, id: oldest.id },
        50
      );
      setMessages((current) => [...rows].reverse().concat(current));
      setHasOlder(rows.length === 50);
    } catch {
      showError('Não foi possível carregar mensagens anteriores.');
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleSend = async () => {
    const body = draft.trim();
    if (!selected || !body || sendingRef.current) return;
    sendingRef.current = true;
    setDraft('');
    try {
      const saved = await sendChatMessage(selected.conversationId, body, crypto.randomUUID());
      setMessages((current) =>
        current.some((item) => item.id === saved.id) ? current : [...current, saved]
      );
      await refreshConversations();
    } catch (error) {
      console.error('[Chat] Falha ao enviar mensagem:', error);
      setDraft(body);
      const errorMessage =
        typeof error === 'object' && error && 'message' in error ? String(error.message) : '';
      showError(
        errorMessage.includes('Limite de 30 mensagens')
          ? 'Limite de mensagens atingido. Aguarde um minuto para continuar.'
          : 'Não foi possível enviar a mensagem.'
      );
    } finally {
      sendingRef.current = false;
    }
  };

  return (
    <div className="chat-trigger relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (isOpen ? closeChat() : setIsOpen(true))}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-emerald-700"
        aria-label="Abrir chat interno"
      >
        <MessageCircle className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-emerald-600 px-1 text-center text-[10px] font-bold leading-4 text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <section
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          className="fixed inset-0 z-[10000] flex bg-white sm:inset-auto sm:right-4 sm:top-16 sm:h-[min(720px,calc(100vh-5rem))] sm:w-[min(860px,calc(100vw-2rem))] sm:overflow-hidden sm:rounded-2xl sm:border sm:border-stone-200 sm:shadow-2xl"
          aria-label="Chat interno"
        >
          <aside
            className={`${selected && !showContacts ? 'hidden sm:flex' : 'flex'} w-full flex-col border-r border-stone-200 sm:w-80`}
          >
            <div className="flex h-16 items-center justify-between border-b border-stone-200 px-4">
              <div>
                <h2 className="font-bold text-stone-900">Chat interno</h2>
                <p className="flex items-center gap-1.5 text-xs text-stone-500" aria-live="polite">
                  <span
                    className={`h-2 w-2 rounded-full ${realtimeStatus === 'connected' ? 'bg-emerald-500' : 'animate-pulse bg-amber-500'}`}
                  />
                  {realtimeStatus === 'connected' ? 'Em tempo real' : 'Reconectando...'}
                </p>
                <select
                  aria-label="Meu status no chat"
                  value={ownStatus}
                  onChange={(event) =>
                    void changeOwnStatus(event.target.value as ChatPresenceStatus)
                  }
                  className="mt-1 max-w-32 bg-transparent text-xs font-medium text-stone-600 outline-none"
                >
                  <option value="available">Disponível</option>
                  <option value="busy">Ocupado</option>
                  <option value="away">Ausente</option>
                  <option value="do_not_disturb">Não perturbe</option>
                </select>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowContacts(true);
                    setCreatingGroup(false);
                    setSearch('');
                  }}
                  className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"
                  aria-label="Nova conversa"
                >
                  <Plus className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={closeChat}
                  className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"
                  aria-label="Fechar chat"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {showContacts ? (
              <>
                <div className="border-b border-stone-200 p-3">
                  <button
                    type="button"
                    onClick={() => setShowContacts(false)}
                    className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-600"
                  >
                    <ArrowLeft className="h-4 w-4" /> Conversas
                  </button>
                  <label className="flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2">
                    <Search className="h-4 w-4 text-stone-400" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
                      placeholder="Buscar nome ou usuário"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setCreatingGroup((value) => !value);
                      setGroupMembers([]);
                    }}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                  >
                    <Users className="h-4 w-4" />{' '}
                    {creatingGroup ? 'Conversa individual' : 'Criar grupo'}
                  </button>
                  {creatingGroup && (
                    <input
                      aria-label="Nome do grupo"
                      value={groupName}
                      onChange={(event) => setGroupName(event.target.value.slice(0, 80))}
                      className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                      placeholder="Nome do grupo"
                    />
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {contacts.map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => {
                        if (!creatingGroup) return void startConversation(contact);
                        setGroupMembers((current) =>
                          current.includes(contact.id)
                            ? current.filter((id) => id !== contact.id)
                            : [...current, contact.id]
                        );
                      }}
                      className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-stone-100"
                    >
                      <span
                        className={`relative flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700 ${avatarRing(contact.id)}`}
                      >
                        {contact.name.slice(0, 1).toUpperCase()}
                        {onlineUserIds.has(contact.id) && (
                          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{contact.name}</span>
                        <span className="block truncate text-xs text-stone-500">
                          {contact.nickname || contact.role}
                        </span>
                      </span>
                      {creatingGroup && (
                        <span
                          className={`ml-auto h-5 w-5 rounded border ${groupMembers.includes(contact.id) ? 'border-emerald-600 bg-emerald-600' : 'border-stone-300'}`}
                        >
                          {groupMembers.includes(contact.id) && (
                            <CheckCheck className="h-4 w-4 text-white" />
                          )}
                        </span>
                      )}
                    </button>
                  ))}
                  {contacts.length === 0 && (
                    <p className="p-6 text-center text-sm text-stone-500">
                      Nenhum usuário encontrado.
                    </p>
                  )}
                </div>
                {creatingGroup && (
                  <div className="border-t border-stone-200 p-3">
                    <button
                      type="button"
                      onClick={() => void handleCreateGroup()}
                      disabled={groupName.trim().length < 2 || groupMembers.length === 0}
                      className="w-full rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:bg-stone-300"
                    >
                      Criar grupo ({groupMembers.length})
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 overflow-y-auto p-2">
                {loadingList ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="p-8 text-center text-sm text-stone-500">
                    <Users className="mx-auto mb-3 h-8 w-8 text-stone-300" />
                    Nenhuma conversa ainda.
                  </div>
                ) : (
                  conversations.map((conversation) => (
                    <button
                      key={conversation.conversationId}
                      type="button"
                      onClick={() => void openConversation(conversation)}
                      className={`flex w-full gap-3 rounded-xl p-3 text-left ${selected?.conversationId === conversation.conversationId ? 'bg-emerald-50' : 'hover:bg-stone-100'}`}
                    >
                      <span
                        className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-200 font-bold text-stone-700 ${avatarRing(conversation.contactId)}`}
                      >
                        {conversation.conversationType === 'group' ? (
                          <Users className="h-5 w-5" />
                        ) : (
                          conversation.contactName.slice(0, 1).toUpperCase()
                        )}
                        {conversation.contactId && onlineUserIds.has(conversation.contactId) && (
                          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold">
                            {conversation.contactName}
                          </span>
                          <span className="shrink-0 text-[10px] text-stone-400">
                            {formatChatTime(conversation.lastMessageAt)}
                          </span>
                        </span>
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-stone-500">
                            {conversation.lastMessageBody || 'Conversa iniciada'}
                          </span>
                          {conversation.unreadCount > 0 && (
                            <span className="rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold text-white">
                              {conversation.unreadCount}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </aside>

          <div
            className={`${selected && !showContacts ? 'flex' : 'hidden sm:flex'} min-w-0 flex-1 flex-col`}
          >
            {selected ? (
              <>
                <header className="flex h-16 items-center gap-3 border-b border-stone-200 px-4">
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="rounded-lg p-2 sm:hidden"
                    aria-label="Voltar às conversas"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => selected.contactId && void openProfile(selected.contactId)}
                    disabled={!selected.contactId}
                    className="min-w-0 flex-1 text-left disabled:cursor-default"
                    title={selected.contactId ? 'Ver perfil e dados de contato' : undefined}
                  >
                    <h3 className="truncate font-bold">{selected.contactName}</h3>
                    <p className="truncate text-xs text-stone-500">
                      {selected.conversationType === 'group'
                        ? `${selected.memberCount} participantes`
                        : `${onlineUserIds.has(selected.contactId ?? '') ? 'Online' : 'Offline'} · ${selected.contactNickname || selected.contactRole}`}
                    </p>
                  </button>
                  {selected.contactId && (
                    <button
                      type="button"
                      onClick={() => void openProfile(selected.contactId!)}
                      className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"
                      aria-label="Ver perfil"
                    >
                      <UserRound className="h-5 w-5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeChat}
                    className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"
                    aria-label="Fechar chat"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </header>
                <div className="flex-1 overflow-y-auto bg-stone-50 p-4">
                  {hasOlder && (
                    <button
                      type="button"
                      onClick={() => void loadOlder()}
                      disabled={loadingOlder}
                      className="mx-auto mb-4 block text-xs font-semibold text-emerald-700 disabled:opacity-50"
                    >
                      {loadingOlder ? 'Carregando...' : 'Carregar mensagens anteriores'}
                    </button>
                  )}
                  {loadingMessages ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {messages.map((message) => {
                        const mine = message.senderId === currentUser.id;
                        return (
                          <div
                            key={message.id}
                            className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${mine ? 'rounded-br-sm bg-emerald-600 text-white' : 'rounded-bl-sm border border-stone-200 bg-white text-stone-800'}`}
                            >
                              <p className="whitespace-pre-wrap break-words">{message.body}</p>
                              <p
                                className={`mt-1 flex items-center justify-end gap-1 text-right text-[10px] ${mine ? 'text-emerald-100' : 'text-stone-400'}`}
                              >
                                {formatChatTime(message.createdAt)}
                                {mine && receipts[message.id]?.fullyRead && (
                                  <Eye className="h-3 w-3" aria-label="Visualizada" />
                                )}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={endRef} />
                    </div>
                  )}
                </div>
                <footer className="border-t border-stone-200 bg-white p-3">
                  {showEmojis && (
                    <div className="mb-2 flex flex-wrap gap-1 rounded-xl border border-stone-200 bg-white p-2 shadow-sm">
                      {['😀', '😂', '😍', '👍', '👏', '🙏', '✅', '🎉', '🚚', '🌱', '📦', '💰'].map(
                        (emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              setDraft((value) => `${value}${emoji}`);
                              setShowEmojis(false);
                            }}
                            className="rounded-lg p-1.5 text-xl hover:bg-stone-100"
                            aria-label={`Adicionar ${emoji}`}
                          >
                            {emoji}
                          </button>
                        )
                      )}
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowEmojis((value) => !value)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100"
                      aria-label="Escolher emoji"
                    >
                      <Smile className="h-5 w-5" />
                    </button>
                    <textarea
                      aria-label="Mensagem do chat"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value.slice(0, 4000))}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          void handleSend();
                        }
                      }}
                      rows={1}
                      className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                      placeholder="Digite uma mensagem"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSend()}
                      disabled={!draft.trim()}
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white disabled:bg-stone-300"
                      aria-label="Enviar mensagem"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-1 text-right text-[10px] text-stone-400">{draft.length}/4000</p>
                </footer>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-center text-sm text-stone-500">
                <div>
                  <MessageCircle className="mx-auto mb-3 h-10 w-10 text-stone-300" />
                  <p>Selecione uma conversa para começar.</p>
                </div>
              </div>
            )}
          </div>
          {showProfile && profile && (
            <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
              <button
                type="button"
                className="absolute inset-0 cursor-default bg-black/30"
                onClick={() => setShowProfile(false)}
                aria-label="Fechar perfil"
              />
              <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700">
                      {profile.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <h3 className="font-bold text-stone-900">{profile.name}</h3>
                      <p className="text-xs text-stone-500">{profile.jobTitle || profile.role}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowProfile(false)}
                    aria-label="Fechar perfil"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <dl className="mt-5 space-y-3 text-sm">
                  <div>
                    <dt className="text-xs font-semibold uppercase text-stone-400">E-mail</dt>
                    <dd>{profile.email}</dd>
                  </div>
                  {profile.phone && (
                    <div>
                      <dt className="text-xs font-semibold uppercase text-stone-400">Telefone</dt>
                      <dd>{profile.phone}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs font-semibold uppercase text-stone-400">Status</dt>
                    <dd>
                      {onlineUserIds.has(profile.id) ? 'Online' : 'Offline'} ·{' '}
                      {profile.chatStatusMessage || profile.chatStatus}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
