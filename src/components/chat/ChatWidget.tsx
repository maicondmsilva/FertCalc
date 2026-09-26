import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Bell,
  BellOff,
  CheckCheck,
  Download,
  Eye,
  FileText,
  Loader2,
  MessageCircle,
  Paperclip,
  Pencil,
  Pin,
  Plus,
  Reply,
  Search,
  Send,
  Settings,
  Smile,
  SmilePlus,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import type { User } from '../../types';
import type {
  ChatContact,
  ChatAttachment,
  ChatConversation,
  ChatGroupMember,
  ChatMessage,
  ChatMessageReceipt,
  ChatMessageSearchResult,
  ChatPresenceStatus,
  ChatProfile,
  ChatReactionSummary,
} from '../../types/chat.types';
import {
  createGroupChat,
  deleteChatConversation,
  deleteChatMessage,
  editChatMessage,
  getChatMessageReceipts,
  getChatProfile,
  getOrCreateDirectChat,
  listChatContacts,
  listChatContactStatuses,
  listChatConversations,
  listChatGroupMembers,
  listChatMessages,
  listChatMessagesAfter,
  listChatMessageReactions,
  listChatMessageAttachments,
  searchChatMessages,
  markChatRead,
  recordChatOperationMetric,
  renameGroupChat,
  sendChatMessage,
  sendChatMessageWithAttachments,
  subscribeToChatAttachments,
  subscribeToChatPresence,
  subscribeToChatReads,
  subscribeToChatMessages,
  subscribeToChatReactions,
  subscribeToChatTyping,
  toggleChatMessageReaction,
  updateOwnChatProfile,
  updateChatGroupMembers,
  updateChatPreferences,
  uploadOwnChatAvatar,
  validateChatAttachmentFiles,
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

const formatFileSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const mergeMessages = (current: ChatMessage[], incoming: ChatMessage[]) => {
  const byId = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => byId.set(message.id, message));
  return [...byId.values()].sort(
    (first, second) =>
      first.createdAt.localeCompare(second.createdAt) || first.id.localeCompare(second.id)
  );
};

const EMOJI_CATEGORIES = {
  recentes: [] as string[],
  rostos: [
    '😀',
    '😃',
    '😄',
    '😁',
    '😂',
    '🤣',
    '😊',
    '😍',
    '🤩',
    '😎',
    '🤔',
    '😮',
    '😢',
    '😭',
    '😡',
    '🥳',
  ],
  gestos: ['👍', '👎', '👏', '🙏', '💪', '🤝', '👌', '✌️', '🫶', '👋', '👉', '✅'],
  trabalho: ['📦', '🚚', '💰', '📊', '📈', '📅', '📌', '💡', '⚠️', '🎯', '🔔', '✉️'],
  natureza: ['🌱', '🌿', '🌾', '🌽', '🌻', '☘️', '🌧️', '☀️', '💧', '🌎'],
  celebracao: ['🎉', '🎊', '🏆', '🌟', '❤️', '💚', '🔥', '💯', '🎁', '🥂'],
} as const;

type EmojiCategory = keyof typeof EMOJI_CATEGORIES;
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '✅'];

export default function ChatWidget({ currentUser }: ChatWidgetProps) {
  const { showError } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [groupSettingsName, setGroupSettingsName] = useState('');
  const [groupSettingsMembers, setGroupSettingsMembers] = useState<ChatGroupMember[]>([]);
  const [groupSettingsContacts, setGroupSettingsContacts] = useState<ChatContact[]>([]);
  const [groupSettingsSelectedIds, setGroupSettingsSelectedIds] = useState<string[]>([]);
  const [loadingGroupSettings, setLoadingGroupSettings] = useState(false);
  const [savingGroupSettings, setSavingGroupSettings] = useState(false);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [search, setSearch] = useState('');
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [messageSearch, setMessageSearch] = useState('');
  const [messageSearchResults, setMessageSearchResults] = useState<ChatMessageSearchResult[]>([]);
  const [searchingMessages, setSearchingMessages] = useState(false);
  const [selected, setSelected] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [messageActionId, setMessageActionId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set());
  const [contactStatuses, setContactStatuses] = useState<Record<string, ChatPresenceStatus>>({});
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
  const [showEmojis, setShowEmojis] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState<EmojiCategory>('rostos');
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => {
    try {
      return JSON.parse(window.localStorage.getItem('fertcalc-chat-recent-emojis') ?? '[]');
    } catch {
      return [];
    }
  });
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, ChatReactionSummary[]>>({});
  const [attachments, setAttachments] = useState<Record<string, ChatAttachment[]>>({});
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [draggingFile, setDraggingFile] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [confirmConversationDeletion, setConfirmConversationDeletion] = useState(false);
  const [deletingConversation, setDeletingConversation] = useState(false);
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
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingControllerRef = useRef<ReturnType<typeof subscribeToChatTyping> | null>(null);
  const typingStopTimerRef = useRef<number | null>(null);
  const lastTypingBroadcastRef = useRef(0);
  const remoteTypingTimersRef = useRef<Map<string, number>>(new Map());

  const unreadCount = useMemo(
    () =>
      conversations.reduce(
        (total, item) =>
          total +
          (item.mutedUntil && new Date(item.mutedUntil).getTime() > Date.now()
            ? 0
            : item.unreadCount),
        0
      ),
    [conversations]
  );

  const isMuted = (conversation: ChatConversation) =>
    Boolean(conversation.mutedUntil && new Date(conversation.mutedUntil).getTime() > Date.now());

  const avatarRing = (userId?: string | null) => {
    const status = userId ? contactStatuses[userId] : undefined;
    if (status === 'do_not_disturb' || status === 'busy') return 'ring-2 ring-red-500';
    if (status === 'away') return 'ring-2 ring-amber-400';
    if (userId && onlineUserIds.has(userId)) return 'ring-2 ring-emerald-500';
    return 'ring-2 ring-stone-300';
  };

  const refreshConversations = useCallback(async () => {
    try {
      const rows = await listChatConversations(50, showArchived);
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
  }, [showArchived]);

  const handleToggleMute = async (conversation: ChatConversation) => {
    try {
      const mutedUntil = isMuted(conversation)
        ? null
        : new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
      await updateChatPreferences(conversation.conversationId, {
        archived: Boolean(conversation.archivedAt),
        mutedUntil,
      });
      setSelected((current) =>
        current?.conversationId === conversation.conversationId
          ? { ...current, mutedUntil }
          : current
      );
      await refreshConversations();
    } catch {
      showError('Não foi possível atualizar o silenciamento desta conversa.');
    }
  };

  const handleTogglePin = async (conversation: ChatConversation) => {
    try {
      const pinned = !conversation.pinnedAt;
      await updateChatPreferences(conversation.conversationId, {
        archived: Boolean(conversation.archivedAt),
        mutedUntil: conversation.mutedUntil,
        pinned,
      });
      setSelected((current) =>
        current?.conversationId === conversation.conversationId
          ? { ...current, pinnedAt: pinned ? new Date().toISOString() : null }
          : current
      );
      await refreshConversations();
    } catch {
      showError('Não foi possível atualizar a fixação desta conversa.');
    }
  };

  const handleArchiveConversation = async (conversation: ChatConversation) => {
    try {
      await updateChatPreferences(conversation.conversationId, {
        archived: true,
        mutedUntil: conversation.mutedUntil,
      });
      setSelected(null);
      selectedRef.current = null;
      await refreshConversations();
    } catch {
      showError('Não foi possível arquivar esta conversa.');
    }
  };

  const handleRestoreConversation = async (conversation: ChatConversation) => {
    try {
      await updateChatPreferences(conversation.conversationId, {
        archived: false,
        mutedUntil: conversation.mutedUntil,
      });
      await refreshConversations();
    } catch {
      showError('Não foi possível restaurar esta conversa.');
    }
  };

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
    return subscribeToChatPresence(
      currentUser.organizationId,
      currentUser.id,
      setOnlineUserIds,
      (status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'TRACK_ERROR') {
          setOnlineUserIds(new Set());
        }
      }
    );
  }, [currentUser.id, currentUser.organizationId]);

  useEffect(() => {
    if (!currentUser.organizationId) return;
    const controller = subscribeToChatTyping(
      currentUser.organizationId,
      currentUser.id,
      (event) => {
        if (event.conversationId !== selectedRef.current?.conversationId) return;
        const existingTimer = remoteTypingTimersRef.current.get(event.userId);
        if (existingTimer) window.clearTimeout(existingTimer);
        setTypingUserIds((current) => {
          const next = new Set(current);
          if (event.isTyping) next.add(event.userId);
          else next.delete(event.userId);
          return next;
        });
        if (event.isTyping) {
          const timer = window.setTimeout(() => {
            setTypingUserIds((current) => {
              const next = new Set(current);
              next.delete(event.userId);
              return next;
            });
            remoteTypingTimersRef.current.delete(event.userId);
          }, 3000);
          remoteTypingTimersRef.current.set(event.userId, timer);
        }
      }
    );
    typingControllerRef.current = controller;
    return () => {
      controller.unsubscribe();
      typingControllerRef.current = null;
      remoteTypingTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      remoteTypingTimersRef.current.clear();
    };
  }, [currentUser.id, currentUser.organizationId]);

  useEffect(() => {
    if (!showMessageSearch || !selected || messageSearch.trim().length < 2) {
      setMessageSearchResults([]);
      setSearchingMessages(false);
      return;
    }
    setSearchingMessages(true);
    let active = true;
    const conversationId = selected.conversationId;
    const timeout = window.setTimeout(() => {
      void searchChatMessages(messageSearch.trim(), conversationId, 20)
        .then((results) => {
          if (active) setMessageSearchResults(results);
        })
        .catch((error) => {
          if (!active) return;
          console.error('[Chat] Falha ao pesquisar mensagens:', error);
          showError('Não foi possível pesquisar as mensagens.');
        })
        .finally(() => {
          if (active) setSearchingMessages(false);
        });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [messageSearch, selected, showError, showMessageSearch]);

  useEffect(() => {
    void listChatContactStatuses()
      .then(({ statuses, avatarUrls: urls }) => {
        setContactStatuses(statuses);
        setAvatarUrls(urls);
      })
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

  const refreshReactions = useCallback(async (conversationId: string) => {
    try {
      const rows = await listChatMessageReactions(conversationId);
      setReactions(
        rows.reduce<Record<string, ChatReactionSummary[]>>((grouped, reaction) => {
          (grouped[reaction.messageId] ??= []).push(reaction);
          return grouped;
        }, {})
      );
    } catch (error) {
      console.error('[Chat] Falha ao atualizar reações:', error);
    }
  }, []);

  const refreshAttachments = useCallback(async (conversationId: string) => {
    try {
      const rows = await listChatMessageAttachments(conversationId);
      setAttachments(
        rows.reduce<Record<string, ChatAttachment[]>>((grouped, attachment) => {
          (grouped[attachment.messageId] ??= []).push(attachment);
          return grouped;
        }, {})
      );
    } catch (error) {
      console.error('[Chat] Falha ao atualizar anexos:', error);
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

  useEffect(
    () =>
      subscribeToChatAttachments(() => {
        const conversationId = selectedRef.current?.conversationId;
        if (conversationId) void refreshAttachments(conversationId);
      }),
    [refreshAttachments]
  );

  useEffect(
    () =>
      subscribeToChatReactions(() => {
        const conversationId = selectedRef.current?.conversationId;
        if (conversationId) void refreshReactions(conversationId);
      }),
    [refreshReactions]
  );

  useEffect(() => {
    void refreshConversations();
    let previousStatus: string | null = null;
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
        if (status === previousStatus) return;
        previousStatus = status;
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
    if (typeof endRef.current?.scrollIntoView === 'function') {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.style.height = 'auto';
    composer.style.height = `${Math.min(composer.scrollHeight, 144)}px`;
    composer.style.overflowY = composer.scrollHeight > 144 ? 'auto' : 'hidden';
  }, [draft]);

  const openConversation = async (conversation: ChatConversation) => {
    setSelected(conversation);
    selectedRef.current = conversation;
    setMessages([]);
    setReplyingTo(null);
    setTypingUserIds(new Set());
    setShowMessageSearch(false);
    setMessageSearch('');
    messagesRef.current = [];
    setShowContacts(false);
    setLoadingMessages(true);
    try {
      const rows = await listChatMessages(conversation.conversationId);
      setMessages((current) => mergeMessages(current, [...rows].reverse()));
      setHasOlder(rows.length === 50);
      await markChatRead(conversation.conversationId);
      await refreshReceipts(conversation.conversationId);
      await refreshReactions(conversation.conversationId);
      await refreshAttachments(conversation.conversationId);
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

  const openGroupSettings = async () => {
    if (!selected || selected.conversationType !== 'group') return;
    setShowGroupSettings(true);
    setLoadingGroupSettings(true);
    setGroupSettingsName(selected.contactName);
    try {
      const [members, availableContacts] = await Promise.all([
        listChatGroupMembers(selected.conversationId),
        listChatContacts('', 50),
      ]);
      setGroupSettingsMembers(members);
      setGroupSettingsContacts(availableContacts);
      setGroupSettingsSelectedIds(
        members.filter((member) => member.participantRole === 'member').map((member) => member.id)
      );
    } catch (error) {
      console.error('[Chat] Falha ao carregar configurações do grupo:', error);
      setShowGroupSettings(false);
      showError('Não foi possível carregar os participantes do grupo.');
    } finally {
      setLoadingGroupSettings(false);
    }
  };

  const saveGroupSettings = async () => {
    if (!selected || selected.conversationType !== 'group' || savingGroupSettings) return;
    const canManage = groupSettingsMembers.some((member) => member.canManage);
    if (!canManage) return;
    const normalizedName = groupSettingsName.trim();
    if (normalizedName.length < 2) {
      showError('Informe um nome com pelo menos 2 caracteres.');
      return;
    }
    setSavingGroupSettings(true);
    try {
      await renameGroupChat(selected.conversationId, normalizedName);
      await updateChatGroupMembers(selected.conversationId, groupSettingsSelectedIds);
      setSelected((current) =>
        current
          ? { ...current, conversationTitle: normalizedName, contactName: normalizedName }
          : current
      );
      selectedRef.current = selectedRef.current
        ? {
            ...selectedRef.current,
            conversationTitle: normalizedName,
            contactName: normalizedName,
          }
        : null;
      setShowGroupSettings(false);
      await refreshConversations();
    } catch (error) {
      console.error('[Chat] Falha ao salvar configurações do grupo:', error);
      showError('Não foi possível atualizar o grupo.');
    } finally {
      setSavingGroupSettings(false);
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

  const changeAvatar = async (file?: File) => {
    if (!file) return;
    try {
      const url = await uploadOwnChatAvatar(currentUser.id, file);
      setAvatarUrls((current) => ({ ...current, [currentUser.id]: url }));
      setProfile((current) => (current ? { ...current, avatarUrl: url } : current));
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Não foi possível atualizar a foto.');
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
    if (!selected || (!body && pendingFiles.length === 0) || sendingRef.current) return;
    if (pendingFiles.length > 0 && !currentUser.organizationId) {
      showError('Não foi possível identificar a empresa para enviar os anexos.');
      return;
    }
    sendingRef.current = true;
    if (typingStopTimerRef.current) window.clearTimeout(typingStopTimerRef.current);
    void typingControllerRef.current?.sendTyping(selected.conversationId, false);
    setUploadingFiles(pendingFiles.length > 0);
    setDraft('');
    try {
      const saved = pendingFiles.length
        ? await sendChatMessageWithAttachments({
            conversationId: selected.conversationId,
            organizationId: currentUser.organizationId!,
            userId: currentUser.id,
            body,
            clientMessageId: crypto.randomUUID(),
            files: pendingFiles,
            replyToMessageId: replyingTo?.id,
          })
        : await sendChatMessage(selected.conversationId, body, crypto.randomUUID(), replyingTo?.id);
      setMessages((current) =>
        current.some((item) => item.id === saved.id) ? current : [...current, saved]
      );
      setPendingFiles([]);
      setReplyingTo(null);
      await refreshAttachments(selected.conversationId);
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
      setUploadingFiles(false);
    }
  };

  const handleDraftChange = (value: string) => {
    const nextValue = value.slice(0, 4000);
    setDraft(nextValue);
    if (!selected) return;
    const now = Date.now();
    if (nextValue && now - lastTypingBroadcastRef.current > 800) {
      lastTypingBroadcastRef.current = now;
      void typingControllerRef.current?.sendTyping(selected.conversationId, true);
    }
    if (typingStopTimerRef.current) window.clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = window.setTimeout(() => {
      void typingControllerRef.current?.sendTyping(selected.conversationId, false);
    }, 1200);
  };

  const revealSearchResult = async (result: ChatMessageSearchResult) => {
    if (!selected || result.conversationId !== selected.conversationId) return;
    try {
      let combined = messagesRef.current;
      let attempts = 0;
      while (!combined.some((message) => message.id === result.id) && attempts < 10) {
        const oldest = combined[0];
        const page = await listChatMessages(
          selected.conversationId,
          oldest ? { createdAt: oldest.createdAt, id: oldest.id } : undefined,
          50
        );
        if (page.length === 0) break;
        combined = mergeMessages([...page].reverse(), combined);
        attempts += 1;
        if (page.length < 50) break;
      }
      setMessages(combined);
      messagesRef.current = combined;
      setShowMessageSearch(false);
      window.requestAnimationFrame(() => {
        document
          .getElementById(`chat-message-${result.id}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    } catch (error) {
      console.error('[Chat] Falha ao localizar mensagem:', error);
      showError('Não foi possível abrir a mensagem encontrada.');
    }
  };

  const addPendingFiles = (files: File[]) => {
    if (files.length === 0) return;
    const next = [...pendingFiles, ...files].slice(0, 5);
    try {
      validateChatAttachmentFiles(next);
      if (pendingFiles.length + files.length > 5)
        showError('Você pode enviar até 5 arquivos por mensagem.');
      setPendingFiles(next);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Arquivo inválido.');
    }
  };

  const beginEditMessage = (message: ChatMessage) => {
    setEditingMessageId(message.id);
    setEditDraft(message.body);
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditDraft('');
  };

  const handleEditMessage = async (messageId: string) => {
    const body = editDraft.trim();
    if (!body || messageActionId) return;
    setMessageActionId(messageId);
    try {
      const updated = await editChatMessage(messageId, body);
      setMessages((current) => mergeMessages(current, [updated]));
      cancelEditMessage();
      await refreshConversations();
    } catch (error) {
      const detail = error instanceof Error ? error.message : '';
      showError(
        detail.includes('15 minutos')
          ? 'O prazo de 15 minutos para editar esta mensagem terminou.'
          : 'Não foi possível editar a mensagem.'
      );
    } finally {
      setMessageActionId(null);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (messageActionId || !window.confirm('Excluir esta mensagem para todos?')) return;
    setMessageActionId(messageId);
    try {
      const updated = await deleteChatMessage(messageId);
      setMessages((current) => mergeMessages(current, [updated]));
      if (editingMessageId === messageId) cancelEditMessage();
      await refreshConversations();
    } catch {
      showError('Não foi possível excluir a mensagem.');
    } finally {
      setMessageActionId(null);
    }
  };

  const handleDeleteConversation = async () => {
    if (!selected || deletingConversation) return;
    setDeletingConversation(true);
    try {
      await deleteChatConversation(selected.conversationId);
      setConfirmConversationDeletion(false);
      setSelected(null);
      selectedRef.current = null;
      setMessages([]);
      messagesRef.current = [];
      setAttachments({});
      setReactions({});
      setReceipts({});
      await refreshConversations();
    } catch (error) {
      console.error('[Chat] Falha ao excluir conversa:', error);
      showError('Não foi possível excluir a conversa.');
    } finally {
      setDeletingConversation(false);
    }
  };

  const rememberEmoji = (emoji: string) => {
    setRecentEmojis((current) => {
      const next = [emoji, ...current.filter((item) => item !== emoji)].slice(0, 18);
      window.localStorage.setItem('fertcalc-chat-recent-emojis', JSON.stringify(next));
      return next;
    });
  };

  const insertEmoji = (emoji: string) => {
    const composer = composerRef.current;
    const start = composer?.selectionStart ?? draft.length;
    const end = composer?.selectionEnd ?? draft.length;
    setDraft(`${draft.slice(0, start)}${emoji}${draft.slice(end)}`.slice(0, 4000));
    rememberEmoji(emoji);
    window.requestAnimationFrame(() => {
      composerRef.current?.focus();
      composerRef.current?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    try {
      await toggleChatMessageReaction(messageId, emoji);
      rememberEmoji(emoji);
      setReactionPickerMessageId(null);
      if (selected) await refreshReactions(selected.conversationId);
    } catch {
      showError('Não foi possível atualizar a reação.');
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void openProfile(currentUser.id)}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-100 font-bold text-emerald-700 ${avatarRing(currentUser.id)}`}
                  aria-label="Abrir meu perfil"
                >
                  {avatarUrls[currentUser.id] ? (
                    <img
                      src={avatarUrls[currentUser.id]}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    currentUser.name.slice(0, 1).toUpperCase()
                  )}
                </button>
                <div>
                  <h2 className="font-bold text-stone-900">Chat interno</h2>
                  <p
                    className="flex items-center gap-1.5 text-xs text-stone-500"
                    aria-live="polite"
                  >
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
                        {avatarUrls[contact.id] ? (
                          <img
                            src={avatarUrls[contact.id]}
                            alt=""
                            className="h-full w-full rounded-full object-cover"
                          />
                        ) : (
                          contact.name.slice(0, 1).toUpperCase()
                        )}
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
                <button
                  type="button"
                  onClick={() => {
                    setShowArchived((value) => !value);
                    setSelected(null);
                    selectedRef.current = null;
                    setLoadingList(true);
                  }}
                  className="mb-2 flex w-full items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-50"
                  aria-label={showArchived ? 'Ver conversas ativas' : 'Ver conversas arquivadas'}
                >
                  {showArchived ? (
                    <ArrowLeft className="h-4 w-4" />
                  ) : (
                    <Archive className="h-4 w-4" />
                  )}
                  {showArchived ? 'Voltar às conversas' : 'Conversas arquivadas'}
                </button>
                {loadingList ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="p-8 text-center text-sm text-stone-500">
                    <Users className="mx-auto mb-3 h-8 w-8 text-stone-300" />
                    {showArchived ? 'Nenhuma conversa arquivada.' : 'Nenhuma conversa ainda.'}
                  </div>
                ) : (
                  conversations.map((conversation) => (
                    <button
                      key={conversation.conversationId}
                      type="button"
                      onClick={() =>
                        showArchived
                          ? void handleRestoreConversation(conversation)
                          : void openConversation(conversation)
                      }
                      className={`flex w-full gap-3 rounded-xl p-3 text-left ${selected?.conversationId === conversation.conversationId ? 'bg-emerald-50' : 'hover:bg-stone-100'}`}
                    >
                      <span
                        className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-200 font-bold text-stone-700 ${avatarRing(conversation.contactId)}`}
                      >
                        {conversation.conversationType === 'group' ? (
                          <Users className="h-5 w-5" />
                        ) : conversation.contactId && avatarUrls[conversation.contactId] ? (
                          <img
                            src={avatarUrls[conversation.contactId]}
                            alt=""
                            className="h-full w-full rounded-full object-cover"
                          />
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
                          <span className="flex shrink-0 items-center gap-1 text-[10px] text-stone-400">
                            {conversation.pinnedAt && (
                              <Pin
                                className="h-3 w-3 text-emerald-600"
                                aria-label="Conversa fixada"
                              />
                            )}
                            {isMuted(conversation) && (
                              <BellOff className="h-3 w-3" aria-label="Conversa silenciada" />
                            )}
                            {showArchived && (
                              <ArchiveRestore className="h-3 w-3" aria-label="Restaurar conversa" />
                            )}
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
                  {selected.conversationType === 'group' && (
                    <button
                      type="button"
                      onClick={() => void openGroupSettings()}
                      className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"
                      aria-label="Gerenciar grupo"
                      title="Gerenciar grupo"
                    >
                      <Settings className="h-5 w-5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleTogglePin(selected)}
                    className={`rounded-lg p-2 hover:bg-stone-100 ${selected.pinnedAt ? 'bg-emerald-50 text-emerald-700' : 'text-stone-500'}`}
                    aria-label={selected.pinnedAt ? 'Desafixar conversa' : 'Fixar conversa'}
                    title={selected.pinnedAt ? 'Desafixar conversa' : 'Fixar conversa'}
                  >
                    <Pin className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggleMute(selected)}
                    className={`rounded-lg p-2 hover:bg-stone-100 ${isMuted(selected) ? 'bg-amber-50 text-amber-700' : 'text-stone-500'}`}
                    aria-label={isMuted(selected) ? 'Ativar notificações' : 'Silenciar por 8 horas'}
                    title={isMuted(selected) ? 'Ativar notificações' : 'Silenciar por 8 horas'}
                  >
                    {isMuted(selected) ? (
                      <BellOff className="h-5 w-5" />
                    ) : (
                      <Bell className="h-5 w-5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleArchiveConversation(selected)}
                    className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"
                    aria-label="Arquivar conversa"
                    title="Arquivar conversa"
                  >
                    <Archive className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMessageSearch((value) => !value)}
                    className={`rounded-lg p-2 hover:bg-stone-100 ${showMessageSearch ? 'bg-emerald-50 text-emerald-700' : 'text-stone-500'}`}
                    aria-label="Pesquisar mensagens"
                    title="Pesquisar mensagens"
                  >
                    <Search className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmConversationDeletion(true)}
                    className="rounded-lg p-2 text-stone-500 hover:bg-red-50 hover:text-red-600"
                    aria-label="Excluir conversa"
                    title="Excluir conversa"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={closeChat}
                    className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"
                    aria-label="Fechar chat"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </header>
                {showMessageSearch && (
                  <div className="relative border-b border-stone-200 bg-white p-3">
                    <label className="flex items-center gap-2 rounded-xl border border-stone-300 px-3 py-2">
                      <Search className="h-4 w-4 text-stone-400" />
                      <input
                        autoFocus
                        value={messageSearch}
                        onChange={(event) => setMessageSearch(event.target.value)}
                        className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
                        placeholder="Pesquisar nesta conversa"
                        aria-label="Pesquisar nesta conversa"
                      />
                      {searchingMessages && (
                        <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
                      )}
                    </label>
                    {messageSearch.trim().length >= 2 && (
                      <div className="absolute left-3 right-3 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-stone-200 bg-white p-1 shadow-xl">
                        {!searchingMessages && messageSearchResults.length === 0 ? (
                          <p className="p-4 text-center text-sm text-stone-500">
                            Nenhuma mensagem encontrada.
                          </p>
                        ) : (
                          messageSearchResults.map((result) => (
                            <button
                              key={result.id}
                              type="button"
                              onClick={() => void revealSearchResult(result)}
                              className="w-full rounded-lg px-3 py-2 text-left hover:bg-stone-100"
                            >
                              <span className="block truncate text-sm text-stone-800">
                                {result.body}
                              </span>
                              <span className="text-[10px] text-stone-400">
                                {formatChatTime(result.createdAt)}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
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
                        const deleted = Boolean(message.deletedAt);
                        const canEdit =
                          mine &&
                          !deleted &&
                          Date.now() - new Date(message.createdAt).getTime() <= 15 * 60 * 1000;
                        return (
                          <div
                            key={message.id}
                            id={`chat-message-${message.id}`}
                            className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`group relative max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${deleted ? 'border border-stone-200 bg-stone-100 text-stone-500' : mine ? 'rounded-br-sm bg-emerald-600 text-white' : 'rounded-bl-sm border border-stone-200 bg-white text-stone-800'}`}
                            >
                              {editingMessageId === message.id ? (
                                <div className="min-w-56 space-y-2">
                                  <textarea
                                    aria-label="Editar mensagem"
                                    value={editDraft}
                                    maxLength={4000}
                                    onChange={(event) => setEditDraft(event.target.value)}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Escape') cancelEditMessage();
                                      if (event.key === 'Enter' && !event.shiftKey) {
                                        event.preventDefault();
                                        void handleEditMessage(message.id);
                                      }
                                    }}
                                    className="max-h-32 min-h-16 w-full resize-y rounded-lg border border-emerald-300 bg-white px-2 py-1.5 text-stone-900 outline-none"
                                  />
                                  <div className="flex justify-end gap-2 text-xs">
                                    <button
                                      type="button"
                                      onClick={cancelEditMessage}
                                      className="rounded px-2 py-1 text-stone-600 hover:bg-stone-100"
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleEditMessage(message.id)}
                                      disabled={!editDraft.trim() || messageActionId === message.id}
                                      className="rounded bg-emerald-700 px-2 py-1 font-semibold text-white disabled:opacity-50"
                                    >
                                      Salvar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {(deleted || message.body !== '📎 Anexo') && (
                                    <>
                                      {!deleted && message.replyPreviewBody && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            message.replyToMessageId &&
                                            document
                                              .getElementById(
                                                `chat-message-${message.replyToMessageId}`
                                              )
                                              ?.scrollIntoView({
                                                behavior: 'smooth',
                                                block: 'center',
                                              })
                                          }
                                          className={`mb-2 block w-full rounded-lg border-l-4 p-2 text-left text-xs ${mine ? 'border-emerald-200 bg-emerald-700/40 text-emerald-50' : 'border-emerald-500 bg-stone-100 text-stone-600'}`}
                                          aria-label="Abrir mensagem citada"
                                        >
                                          <span className="block font-semibold">
                                            {message.replyPreviewSenderName ?? 'Mensagem citada'}
                                          </span>
                                          <span className="block truncate">
                                            {message.replyPreviewBody}
                                          </span>
                                        </button>
                                      )}
                                      <p
                                        className={`whitespace-pre-wrap break-words ${deleted ? 'italic' : ''}`}
                                      >
                                        {deleted ? 'Mensagem excluída' : message.body}
                                      </p>
                                    </>
                                  )}
                                  {!deleted && (attachments[message.id]?.length ?? 0) > 0 && (
                                    <div className="mt-2 space-y-1.5">
                                      {attachments[message.id].map((attachment) =>
                                        attachment.mimeType.startsWith('image/') &&
                                        attachment.signedUrl ? (
                                          <a
                                            key={attachment.id}
                                            href={attachment.signedUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block overflow-hidden rounded-lg border border-white/30 bg-white/10"
                                          >
                                            <img
                                              src={attachment.signedUrl}
                                              alt={attachment.fileName}
                                              className="max-h-48 w-full object-cover"
                                            />
                                            <span className="block truncate px-2 py-1 text-xs">
                                              {attachment.fileName}
                                            </span>
                                          </a>
                                        ) : (
                                          <a
                                            key={attachment.id}
                                            href={attachment.signedUrl ?? '#'}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 p-2"
                                          >
                                            <FileText className="h-5 w-5 shrink-0" />
                                            <span className="min-w-0 flex-1">
                                              <span className="block truncate text-xs font-semibold">
                                                {attachment.fileName}
                                              </span>
                                              <span className="block text-[10px] opacity-75">
                                                {formatFileSize(attachment.sizeBytes)}
                                              </span>
                                            </span>
                                            <Download className="h-4 w-4 shrink-0" />
                                          </a>
                                        )
                                      )}
                                    </div>
                                  )}
                                </>
                              )}
                              {!deleted && editingMessageId !== message.id && (
                                <div className="absolute -top-3 right-2 flex gap-1 rounded-lg border border-stone-200 bg-white p-1 text-stone-600 opacity-80 shadow-md sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReplyingTo(message);
                                      window.setTimeout(() => composerRef.current?.focus(), 0);
                                    }}
                                    className="rounded p-1 hover:bg-stone-100"
                                    aria-label="Responder mensagem"
                                  >
                                    <Reply className="h-3.5 w-3.5" />
                                  </button>
                                  {canEdit && (
                                    <button
                                      type="button"
                                      onClick={() => beginEditMessage(message)}
                                      className="rounded p-1 hover:bg-stone-100"
                                      aria-label="Editar mensagem"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  {mine && (
                                    <button
                                      type="button"
                                      onClick={() => void handleDeleteMessage(message.id)}
                                      disabled={messageActionId === message.id}
                                      className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-50"
                                      aria-label="Excluir mensagem"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              )}
                              {!deleted && editingMessageId !== message.id && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setReactionPickerMessageId((current) =>
                                      current === message.id ? null : message.id
                                    )
                                  }
                                  className={`absolute -bottom-3 ${mine ? 'left-2' : 'right-2'} rounded-full border border-stone-200 bg-white p-1 text-stone-500 opacity-80 shadow-sm hover:bg-stone-50 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100`}
                                  aria-label="Reagir à mensagem"
                                >
                                  <SmilePlus className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <p
                                className={`mt-1 flex items-center justify-end gap-1 text-right text-[10px] ${mine && !deleted ? 'text-emerald-100' : 'text-stone-400'}`}
                              >
                                {formatChatTime(message.createdAt)}
                                {message.editedAt && !deleted && <span>editada</span>}
                                {mine && receipts[message.id]?.fullyRead && (
                                  <Eye className="h-3 w-3" aria-label="Visualizada" />
                                )}
                              </p>
                              {!deleted && (reactions[message.id]?.length ?? 0) > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {reactions[message.id].map((reaction) => (
                                    <button
                                      key={reaction.emoji}
                                      type="button"
                                      onClick={() =>
                                        void handleToggleReaction(message.id, reaction.emoji)
                                      }
                                      className={`rounded-full border px-1.5 py-0.5 text-xs ${reaction.reactedByMe ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-stone-200 bg-white text-stone-700'}`}
                                      aria-label={`${reaction.reactedByMe ? 'Remover' : 'Adicionar'} reação ${reaction.emoji}`}
                                    >
                                      {reaction.emoji} {reaction.count}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {reactionPickerMessageId === message.id && (
                                <div
                                  className={`absolute bottom-8 z-10 flex gap-1 rounded-xl border border-stone-200 bg-white p-1.5 shadow-xl ${mine ? 'right-0' : 'left-0'}`}
                                >
                                  {QUICK_REACTIONS.map((emoji) => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() => void handleToggleReaction(message.id, emoji)}
                                      className="rounded-lg p-1 text-lg hover:bg-stone-100"
                                      aria-label={`Reagir com ${emoji}`}
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <div ref={endRef} />
                    </div>
                  )}
                </div>
                <footer
                  className={`relative border-t bg-white p-3 ${draggingFile ? 'border-emerald-500 ring-2 ring-inset ring-emerald-400' : 'border-stone-200'}`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setDraggingFile(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node))
                      setDraggingFile(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDraggingFile(false);
                    addPendingFiles(Array.from(event.dataTransfer.files));
                  }}
                >
                  {typingUserIds.size > 0 && (
                    <p className="mb-2 text-xs font-medium text-emerald-700" aria-live="polite">
                      {selected.conversationType === 'direct'
                        ? `${selected.contactName} está digitando…`
                        : `${typingUserIds.size === 1 ? 'Uma pessoa está' : `${typingUserIds.size} pessoas estão`} digitando…`}
                    </p>
                  )}
                  {draggingFile && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-emerald-50/95 text-sm font-bold text-emerald-800">
                      Solte os arquivos para anexar
                    </div>
                  )}
                  {pendingFiles.length > 0 && (
                    <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                      {pendingFiles.map((file, index) => (
                        <div
                          key={`${file.name}-${file.size}-${index}`}
                          className="flex max-w-48 shrink-0 items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 text-xs"
                        >
                          <Paperclip className="h-4 w-4 shrink-0 text-emerald-700" />
                          <span className="min-w-0 flex-1 truncate">{file.name}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setPendingFiles((current) =>
                                current.filter((_, itemIndex) => itemIndex !== index)
                              )
                            }
                            aria-label={`Remover ${file.name}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {showEmojis && (
                    <div className="mb-2 rounded-xl border border-stone-200 bg-white p-2 shadow-sm">
                      <div className="mb-2 flex gap-1 overflow-x-auto border-b border-stone-100 pb-2">
                        {(Object.keys(EMOJI_CATEGORIES) as EmojiCategory[]).map((category) => (
                          <button
                            key={category}
                            type="button"
                            onClick={() => setEmojiCategory(category)}
                            disabled={category === 'recentes' && recentEmojis.length === 0}
                            className={`whitespace-nowrap rounded-lg px-2 py-1 text-xs font-semibold capitalize ${emojiCategory === category ? 'bg-emerald-100 text-emerald-800' : 'text-stone-500 hover:bg-stone-100'} disabled:opacity-40`}
                          >
                            {category}
                          </button>
                        ))}
                      </div>
                      <div className="grid max-h-36 grid-cols-8 gap-1 overflow-y-auto">
                        {(emojiCategory === 'recentes'
                          ? recentEmojis
                          : EMOJI_CATEGORIES[emojiCategory]
                        ).map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => insertEmoji(emoji)}
                            className="rounded-lg p-1.5 text-xl hover:bg-stone-100"
                            aria-label={`Adicionar ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {replyingTo && (
                    <div className="mb-2 flex items-start gap-2 rounded-xl border-l-4 border-emerald-500 bg-stone-100 px-3 py-2 text-xs text-stone-600">
                      <Reply className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <div className="min-w-0 flex-1">
                        <span className="block font-semibold text-emerald-700">
                          Respondendo à mensagem
                        </span>
                        <span className="block truncate">{replyingTo.body}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReplyingTo(null)}
                        className="rounded p-1 hover:bg-stone-200"
                        aria-label="Cancelar resposta"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="sr-only"
                      accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                      onChange={(event) => {
                        addPendingFiles(Array.from(event.target.files ?? []));
                        event.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100"
                      aria-label="Anexar arquivos"
                    >
                      <Paperclip className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEmojis((value) => !value)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100"
                      aria-label="Escolher emoji"
                    >
                      <Smile className="h-5 w-5" />
                    </button>
                    <textarea
                      ref={composerRef}
                      aria-label="Mensagem do chat"
                      value={draft}
                      onChange={(event) => handleDraftChange(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          void handleSend();
                        }
                      }}
                      rows={1}
                      className="max-h-36 min-h-10 flex-1 resize-none rounded-xl border border-stone-300 px-3 py-2 text-sm leading-5 outline-none transition-[height] focus:border-emerald-500"
                      placeholder="Digite uma mensagem"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSend()}
                      disabled={(!draft.trim() && pendingFiles.length === 0) || uploadingFiles}
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white disabled:bg-stone-300"
                      aria-label="Enviar mensagem"
                    >
                      {uploadingFiles ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-right text-[10px] text-stone-400">
                    {uploadingFiles
                      ? `Enviando ${pendingFiles.length} arquivo(s)...`
                      : `${draft.length}/4000`}
                  </p>
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
          {showGroupSettings && selected?.conversationType === 'group' && (
            <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
              <button
                type="button"
                className="absolute inset-0 cursor-default bg-black/40"
                onClick={() => !savingGroupSettings && setShowGroupSettings(false)}
                aria-label="Fechar configurações do grupo"
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="group-settings-title"
                className="relative flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-stone-200 p-4">
                  <div>
                    <h3 id="group-settings-title" className="font-bold text-stone-900">
                      Gerenciar grupo
                    </h3>
                    <p className="text-xs text-stone-500">Nome e participantes da conversa</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGroupSettings(false)}
                    disabled={savingGroupSettings}
                    aria-label="Fechar configurações do grupo"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                {loadingGroupSettings ? (
                  <div className="flex justify-center p-10">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                  </div>
                ) : (
                  <>
                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                      <label className="block text-sm font-semibold text-stone-700">
                        Nome do grupo
                        <input
                          value={groupSettingsName}
                          maxLength={80}
                          disabled={!groupSettingsMembers.some((member) => member.canManage)}
                          onChange={(event) => setGroupSettingsName(event.target.value)}
                          className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 font-normal outline-none focus:border-emerald-500 disabled:bg-stone-100"
                        />
                      </label>
                      <div>
                        <p className="mb-2 text-sm font-semibold text-stone-700">Participantes</p>
                        <div className="space-y-1">
                          {groupSettingsMembers
                            .filter((member) => member.participantRole !== 'member')
                            .map((member) => (
                              <div
                                key={member.id}
                                className="flex items-center gap-3 rounded-xl bg-stone-50 p-3"
                              >
                                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">
                                  {member.name.slice(0, 1).toUpperCase()}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold">
                                    {member.name}
                                  </span>
                                  <span className="text-xs text-stone-500">
                                    {member.participantRole === 'owner'
                                      ? 'Proprietário'
                                      : 'Administrador'}
                                  </span>
                                </span>
                                <span className="text-xs font-semibold text-stone-400">
                                  Protegido
                                </span>
                              </div>
                            ))}
                          {groupSettingsContacts
                            .filter(
                              (contact) =>
                                !groupSettingsMembers.some(
                                  (member) =>
                                    member.id === contact.id && member.participantRole !== 'member'
                                )
                            )
                            .map((contact) => {
                              const checked = groupSettingsSelectedIds.includes(contact.id);
                              const canManage = groupSettingsMembers.some(
                                (member) => member.canManage
                              );
                              return (
                                <label
                                  key={contact.id}
                                  className="flex cursor-pointer items-center gap-3 rounded-xl p-3 hover:bg-stone-50"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={!canManage}
                                    onChange={() =>
                                      setGroupSettingsSelectedIds((current) =>
                                        checked
                                          ? current.filter((id) => id !== contact.id)
                                          : [...current, contact.id]
                                      )
                                    }
                                    className="h-4 w-4 accent-emerald-600"
                                  />
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold">
                                      {contact.name}
                                    </span>
                                    <span className="block truncate text-xs text-stone-500">
                                      {contact.nickname || contact.role}
                                    </span>
                                  </span>
                                </label>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 border-t border-stone-200 p-4">
                      <button
                        type="button"
                        onClick={() => setShowGroupSettings(false)}
                        disabled={savingGroupSettings}
                        className="rounded-xl px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100"
                      >
                        Cancelar
                      </button>
                      {groupSettingsMembers.some((member) => member.canManage) && (
                        <button
                          type="button"
                          onClick={() => void saveGroupSettings()}
                          disabled={savingGroupSettings || groupSettingsName.trim().length < 2}
                          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:bg-stone-300"
                        >
                          {savingGroupSettings && <Loader2 className="h-4 w-4 animate-spin" />}
                          Salvar grupo
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          {confirmConversationDeletion && selected && (
            <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
              <button
                type="button"
                className="absolute inset-0 cursor-default bg-black/40"
                onClick={() => !deletingConversation && setConfirmConversationDeletion(false)}
                aria-label="Cancelar exclusão da conversa"
              />
              <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="delete-conversation-title"
                className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <Trash2 className="h-5 w-5" />
                </div>
                <h3
                  id="delete-conversation-title"
                  className="mt-4 text-lg font-bold text-stone-900"
                >
                  Excluir esta conversa?
                </h3>
                <p className="mt-2 text-sm leading-5 text-stone-600">
                  Ela será removida somente para você. Os outros participantes continuarão com o
                  histórico. Se chegar uma nova mensagem, a conversa reaparecerá sem as mensagens
                  anteriores.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmConversationDeletion(false)}
                    disabled={deletingConversation}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteConversation()}
                    disabled={deletingConversation}
                    className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:bg-red-300"
                  >
                    {deletingConversation && <Loader2 className="h-4 w-4 animate-spin" />}
                    Excluir conversa
                  </button>
                </div>
              </div>
            </div>
          )}
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
                      {profile.avatarUrl ? (
                        <img
                          src={profile.avatarUrl}
                          alt=""
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        profile.name.slice(0, 1).toUpperCase()
                      )}
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
                {profile.id === currentUser.id && (
                  <label className="mt-5 block cursor-pointer rounded-xl bg-emerald-600 px-4 py-2 text-center text-sm font-bold text-white hover:bg-emerald-700">
                    Escolher foto
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={(event) => void changeAvatar(event.target.files?.[0])}
                    />
                  </label>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

