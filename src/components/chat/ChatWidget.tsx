import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Loader2, MessageCircle, Plus, Search, Send, Users, X } from 'lucide-react';
import type { User } from '../../types';
import type { ChatContact, ChatConversation, ChatMessage } from '../../types/chat.types';
import {
  getOrCreateDirectChat,
  listChatContacts,
  listChatConversations,
  listChatMessages,
  listChatMessagesAfter,
  markChatRead,
  sendChatMessage,
  subscribeToChatMessages,
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
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
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

  const unreadCount = useMemo(
    () => conversations.reduce((total, item) => total + item.unreadCount, 0),
    [conversations]
  );

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

  const reconcileSelectedConversation = useCallback(async () => {
    const conversation = selectedRef.current;
    const latestKnown = messagesRef.current.at(-1);
    if (!conversation || !latestKnown || recoveringRef.current) return;

    recoveringRef.current = true;
    setRealtimeStatus('recovering');
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
    } catch (error) {
      console.error('[Chat] Falha ao reconciliar mensagens:', error);
      setRealtimeStatus('recovering');
    } finally {
      recoveringRef.current = false;
    }
  }, [refreshConversations]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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
          void refreshConversations();
          void reconcileSelectedConversation();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setRealtimeStatus('recovering');
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
        contactId: contact.id,
        contactName: contact.name,
        contactNickname: contact.nickname,
        contactRole: contact.role,
        unreadCount: 0,
      };
      await refreshConversations();
      await openConversation(conversation);
    } catch (error) {
      console.error('[Chat] Falha ao iniciar conversa:', error);
      showError('Não foi possível iniciar a conversa.');
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
      showError('Não foi possível enviar a mensagem.');
    } finally {
      sendingRef.current = false;
    }
  };

  return (
    <div className="chat-trigger relative">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
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
          className="fixed inset-0 z-[10000] flex bg-white sm:inset-auto sm:right-4 sm:top-16 sm:h-[min(720px,calc(100vh-5rem))] sm:w-[min(860px,calc(100vw-2rem))] sm:overflow-hidden sm:rounded-2xl sm:border sm:border-stone-200 sm:shadow-2xl"
          aria-label="Chat interno"
        >
          <aside
            className={`${selected && !showContacts ? 'hidden sm:flex' : 'flex'} w-full flex-col border-r border-stone-200 sm:w-80`}
          >
            <div className="flex h-16 items-center justify-between border-b border-stone-200 px-4">
              <div>
                <h2 className="font-bold text-stone-900">Chat interno</h2>
                <p className="flex items-center gap-1.5 text-xs text-stone-500">
                  <span
                    className={`h-2 w-2 rounded-full ${realtimeStatus === 'connected' ? 'bg-emerald-500' : 'animate-pulse bg-amber-500'}`}
                  />
                  {realtimeStatus === 'connected' ? 'Em tempo real' : 'Reconectando...'}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowContacts(true);
                    setSearch('');
                  }}
                  className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"
                  aria-label="Nova conversa"
                >
                  <Plus className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
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
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {contacts.map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => void startConversation(contact)}
                      className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-stone-100"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">
                        {contact.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{contact.name}</span>
                        <span className="block truncate text-xs text-stone-500">
                          {contact.nickname || contact.role}
                        </span>
                      </span>
                    </button>
                  ))}
                  {contacts.length === 0 && (
                    <p className="p-6 text-center text-sm text-stone-500">
                      Nenhum usuário encontrado.
                    </p>
                  )}
                </div>
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
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-200 font-bold text-stone-700">
                        {conversation.contactName.slice(0, 1).toUpperCase()}
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
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-bold">{selected.contactName}</h3>
                    <p className="truncate text-xs text-stone-500">
                      {selected.contactNickname || selected.contactRole}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
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
                                className={`mt-1 text-right text-[10px] ${mine ? 'text-emerald-100' : 'text-stone-400'}`}
                              >
                                {formatChatTime(message.createdAt)}
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
                  <div className="flex items-end gap-2">
                    <textarea
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
        </section>
      )}
    </div>
  );
}
