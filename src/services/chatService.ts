import { supabase } from './supabase';
import type { ChatContact, ChatConversation, ChatMessage } from '../types/chat.types';

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
  void recordChatOperationMetric(operation, status, performance.now() - startedAt, details).catch(
    (error) => console.warn('[Chat] Falha ao registrar métrica operacional:', error)
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
    contactId: row.contact_id as string,
    contactName: row.contact_name as string,
    contactNickname: row.contact_nickname as string | null,
    contactRole: row.contact_role as string,
    lastMessageBody: row.last_message_body as string | null,
    lastMessageSenderId: row.last_message_sender_id as string | null,
    lastMessageAt: row.last_message_at as string | null,
    unreadCount: Number(row.unread_count ?? 0),
  }));
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
  const startedAt = performance.now();
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
    .subscribe((status) => onStatus?.(status));

  return () => {
    void supabase.removeChannel(channel);
  };
}
