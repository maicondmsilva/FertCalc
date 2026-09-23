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

export async function sendChatMessage(
  conversationId: string,
  body: string,
  clientMessageId: string
): Promise<ChatMessage> {
  const { data, error } = await supabase.rpc('send_chat_message', {
    p_conversation_id: conversationId,
    p_body: body,
    p_client_message_id: clientMessageId,
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
    .subscribe((status) => onStatus?.(status));

  return () => {
    void supabase.removeChannel(channel);
  };
}
