import { supabase } from './supabase';
import type {
  ChatContact,
  ChatConversation,
  ChatMessage,
  ChatMessageSearchResult,
  ChatMessageReceipt,
  ChatPresenceStatus,
  ChatProfile,
  ChatReactionSummary,
} from '../types/chat.types';

export async function updateChatPreferences(
  conversationId: string,
  options: { archived?: boolean; mutedUntil?: string | null }
): Promise<void> {
  const { error } = await supabase.rpc('update_chat_preferences', {
    p_conversation_id: conversationId,
    p_archived: options.archived ?? false,
    p_muted_until: options.mutedUntil ?? null,
  });
  if (error) throw error;
}

export async function renameGroupChat(conversationId: string, name: string): Promise<void> {
  const { error } = await supabase.rpc('rename_group_chat', {
    p_conversation_id: conversationId,
    p_name: name,
  });
  if (error) throw error;
}

export async function searchChatMessages(
  search: string,
  conversationId?: string,
  limit = 50
): Promise<ChatMessageSearchResult[]> {
  const { data, error } = await supabase.rpc('search_chat_messages', {
    p_search: search,
    p_conversation_id: conversationId ?? null,
    p_limit: limit,
  });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    conversationId: row.conversation_id as string,
    senderId: row.sender_id as string,
    body: row.body as string,
    createdAt: row.created_at as string,
  }));
}

export async function listChatContactStatuses(): Promise<{
  statuses: Record<string, ChatPresenceStatus>;
  avatarUrls: Record<string, string>;
}> {
  const { data, error } = await supabase.rpc('list_chat_contact_statuses');
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  const statuses = Object.fromEntries(
    rows.map((row) => [row.user_id as string, row.chat_status as ChatPresenceStatus])
  );
  const avatarUrls: Record<string, string> = {};
  await Promise.all(
    rows.map(async (row) => {
      const path = row.avatar_path as string | null;
      if (!path) return;
      const { data: signed } = await supabase.storage
        .from('chat-avatars')
        .createSignedUrl(path, 3600);
      if (signed?.signedUrl) avatarUrls[row.user_id as string] = signed.signedUrl;
    })
  );
  return { statuses, avatarUrls };
}

type ChatMessageRow = {
  id: string;
  conversation_id: string;
  organization_id: string;
  sender_id: string;
  client_message_id: string;
  body: string;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
};

const mapMessage = (row: ChatMessageRow): ChatMessage => ({
  id: row.id,
  conversationId: row.conversation_id,
  organizationId: row.organization_id,
  senderId: row.sender_id,
  clientMessageId: row.client_message_id,
  body: row.body,
  createdAt: row.created_at,
  editedAt: row.edited_at,
  deletedAt: row.deleted_at,
});

export type ChatMetricOperation = 'message_send' | 'message_recovery' | 'realtime_connection';

export async function recordChatOperationMetric(
  operation: ChatMetricOperation,
  status: 'success' | 'error',
  durationMs?: number,
  details: Record<string, string | number | boolean | null> = {}
): Promise<void> {
  const { error } = await supabase.rpc('record_chat_operation_metric', {
    p_operation: operation,
    p_status: status,
    p_duration_ms: durationMs == null ? null : Math.max(0, Math.round(durationMs)),
    p_details: details,
  });
  if (error) throw error;
}

const observeChatOperation = (
  operation: ChatMetricOperation,
  status: 'success' | 'error',
  startedAt: number,
  details?: Record<string, string | number | boolean | null>
) => {
  void recordChatOperationMetric(operation, status, Date.now() - startedAt, details).catch(
    (error) => console.error('[Chat] Falha ao registrar métrica operacional:', error)
  );
};

export async function listChatContacts(search = '', limit = 20): Promise<ChatContact[]> {
  const { data, error } = await supabase.rpc('list_chat_contacts', {
    p_search: search || null,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as ChatContact[];
}

export async function listChatConversations(limit = 50): Promise<ChatConversation[]> {
  const { data, error } = await supabase.rpc('list_chat_conversations', { p_limit: limit });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    conversationId: row.conversation_id as string,
    conversationType: (row.conversation_type as 'direct' | 'group') ?? 'direct',
    conversationTitle: row.conversation_title as string | null,
    contactId: row.contact_id as string | null,
    contactName: row.contact_name as string,
    contactNickname: row.contact_nickname as string | null,
    contactRole: row.contact_role as string,
    memberCount: Number(row.member_count ?? 2),
    lastMessageBody: row.last_message_body as string | null,
    lastMessageSenderId: row.last_message_sender_id as string | null,
    lastMessageAt: row.last_message_at as string | null,
    unreadCount: Number(row.unread_count ?? 0),
  }));
}

export async function createGroupChat(name: string, memberIds: string[]): Promise<string> {
  const { data, error } = await supabase.rpc('create_group_chat', {
    p_name: name,
    p_member_ids: memberIds,
  });
  if (error) throw error;
  return data as string;
}

export async function getChatMessageReceipts(
  conversationId: string
): Promise<ChatMessageReceipt[]> {
  const { data, error } = await supabase.rpc('get_chat_message_receipts', {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    messageId: row.message_id as string,
    readByCount: Number(row.read_by_count ?? 0),
    recipientCount: Number(row.recipient_count ?? 0),
    fullyRead: Boolean(row.fully_read),
  }));
}

export async function listChatMessageReactions(
  conversationId: string
): Promise<ChatReactionSummary[]> {
  const { data, error } = await supabase.rpc('list_chat_message_reactions', {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    messageId: row.message_id as string,
    emoji: row.emoji as string,
    count: Number(row.reaction_count ?? 0),
    reactedByMe: Boolean(row.reacted_by_me),
  }));
}

export async function toggleChatMessageReaction(
  messageId: string,
  emoji: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('toggle_chat_message_reaction', {
    p_message_id: messageId,
    p_emoji: emoji,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function getChatProfile(userId: string): Promise<ChatProfile | null> {
  const { data, error } = await supabase.rpc('get_chat_profile', { p_user_id: userId });
  if (error) throw error;
  const row = (data?.[0] ?? null) as Record<string, unknown> | null;
  if (!row) return null;
  const avatarPath = row.avatar_path as string | null;
  const avatarUrl = avatarPath
    ? (await supabase.storage.from('chat-avatars').createSignedUrl(avatarPath, 3600)).data
        ?.signedUrl
    : null;
  return {
    id: row.id as string,
    name: row.name as string,
    nickname: row.nickname as string | null,
    email: row.email as string,
    phone: row.phone as string | null,
    jobTitle: row.job_title as string | null,
    role: row.role as string,
    chatStatus: row.chat_status as ChatPresenceStatus,
    chatStatusMessage: row.chat_status_message as string | null,
    avatarPath,
    avatarUrl,
  };
}

export async function uploadOwnChatAvatar(userId: string, file: File): Promise<string> {
  if (file.size > 2 * 1024 * 1024) throw new Error('A foto deve possuir no máximo 2 MB.');
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Use uma imagem PNG, JPG ou WEBP.');
  }
  const path = `${userId}/avatar.${extension}`;
  const { error: uploadError } = await supabase.storage.from('chat-avatars').upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (uploadError) throw uploadError;
  const { error } = await supabase.rpc('set_own_chat_avatar', { p_avatar_path: path });
  if (error) throw error;
  const { data } = await supabase.storage.from('chat-avatars').createSignedUrl(path, 3600);
  if (!data?.signedUrl) throw new Error('Não foi possível carregar a foto enviada.');
  return data.signedUrl;
}

export async function updateOwnChatProfile(input: {
  phone?: string | null;
  jobTitle?: string | null;
  status: ChatPresenceStatus;
  statusMessage?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('update_own_chat_profile', {
    p_phone: input.phone ?? null,
    p_job_title: input.jobTitle ?? null,
    p_chat_status: input.status,
    p_chat_status_message: input.statusMessage ?? null,
  });
  if (error) throw error;
}

export function subscribeToChatPresence(
  organizationId: string,
  userId: string,
  callback: (onlineUserIds: Set<string>) => void
) {
  const channel = supabase.channel(`chat-presence:${organizationId}`, {
    config: { private: true, presence: { key: userId } },
  });
  channel.on('presence', { event: 'sync' }, () => {
    callback(new Set(Object.keys(channel.presenceState())));
  });
  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED')
      await channel.track({ user_id: userId, online_at: new Date().toISOString() });
  });
  return () => {
    void channel.untrack();
    void supabase.removeChannel(channel);
  };
}

export function subscribeToChatReads(callback: () => void) {
  const channel = supabase
    .channel('chat-read-receipts')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'chat_participants' },
      callback
    )
    .subscribe();
  return () => void supabase.removeChannel(channel);
}

export function subscribeToChatReactions(callback: () => void) {
  const channel = supabase
    .channel('chat-message-reactions')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'chat_message_reactions' },
      callback
    )
    .subscribe();
  return () => void supabase.removeChannel(channel);
}

export async function getOrCreateDirectChat(targetUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_direct_chat', {
    p_target_user_id: targetUserId,
  });
  if (error) throw error;
  return data as string;
}

export async function listChatMessages(
  conversationId: string,
  cursor?: { createdAt: string; id: string },
  limit = 50
): Promise<ChatMessage[]> {
  const { data, error } = await supabase.rpc('get_chat_messages', {
    p_conversation_id: conversationId,
    p_before_created_at: cursor?.createdAt ?? null,
    p_before_id: cursor?.id ?? null,
    p_limit: limit,
  });
  if (error) throw error;
  return ((data ?? []) as ChatMessageRow[]).map(mapMessage);
}

export async function listChatMessagesAfter(
  conversationId: string,
  cursor: { createdAt: string; id: string },
  limit = 100
): Promise<ChatMessage[]> {
  const { data, error } = await supabase.rpc('get_chat_messages_after', {
    p_conversation_id: conversationId,
    p_after_created_at: cursor.createdAt,
    p_after_id: cursor.id,
    p_limit: limit,
  });
  if (error) throw error;
  return ((data ?? []) as ChatMessageRow[]).map(mapMessage);
}

export async function sendChatMessage(
  conversationId: string,
  body: string,
  clientMessageId: string
): Promise<ChatMessage> {
  const startedAt = Date.now();
  try {
    const { data, error } = await supabase.rpc('send_chat_message', {
      p_conversation_id: conversationId,
      p_body: body,
      p_client_message_id: clientMessageId,
    });
    if (error) throw error;
    observeChatOperation('message_send', 'success', startedAt);
    return mapMessage(data as ChatMessageRow);
  } catch (error) {
    observeChatOperation('message_send', 'error', startedAt, {
      code: typeof error === 'object' && error && 'code' in error ? String(error.code) : 'unknown',
    });
    throw error;
  }
}

export async function editChatMessage(messageId: string, body: string): Promise<ChatMessage> {
  const { data, error } = await supabase.rpc('edit_chat_message', {
    p_message_id: messageId,
    p_body: body,
  });
  if (error) throw error;
  return mapMessage(data as ChatMessageRow);
}

export async function deleteChatMessage(messageId: string): Promise<ChatMessage> {
  const { data, error } = await supabase.rpc('delete_chat_message', {
    p_message_id: messageId,
  });
  if (error) throw error;
  return mapMessage(data as ChatMessageRow);
}

export async function markChatRead(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_chat_read', {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
}

export function subscribeToChatMessages(
  userId: string,
  callback: (message: ChatMessage) => void,
  onStatus?: (status: string) => void
) {
  const channel = supabase
    .channel(`chat-messages:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages' },
      (payload) => callback(mapMessage(payload.new as ChatMessageRow))
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'chat_messages' },
      (payload) => callback(mapMessage(payload.new as ChatMessageRow))
    )
    .subscribe((status) => onStatus?.(status));

  return () => {
    void supabase.removeChannel(channel);
  };
}
