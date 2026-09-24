export interface ChatContact {
  id: string;
  name: string;
  nickname?: string | null;
  role: string;
}

export interface ChatGroupMember extends ChatContact {
  participantRole: 'owner' | 'admin' | 'member';
  canManage: boolean;
}

export interface ChatConversation {
  conversationId: string;
  conversationType: 'direct' | 'group';
  conversationTitle?: string | null;
  contactId?: string | null;
  contactName: string;
  contactNickname?: string | null;
  contactRole: string;
  memberCount: number;
  lastMessageBody?: string | null;
  lastMessageSenderId?: string | null;
  lastMessageAt?: string | null;
  unreadCount: number;
}

export type ChatPresenceStatus = 'available' | 'busy' | 'away' | 'do_not_disturb';

export interface ChatProfile {
  id: string;
  name: string;
  nickname?: string | null;
  email: string;
  phone?: string | null;
  jobTitle?: string | null;
  role: string;
  chatStatus: ChatPresenceStatus;
  chatStatusMessage?: string | null;
  avatarPath?: string | null;
  avatarUrl?: string | null;
}

export interface ChatMessageReceipt {
  messageId: string;
  readByCount: number;
  recipientCount: number;
  fullyRead: boolean;
}

export interface ChatReactionSummary {
  messageId: string;
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export interface ChatAttachment {
  id: string;
  messageId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  signedUrl?: string | null;
}

export interface ChatMessageSearchResult {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface ChatTypingEvent {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  organizationId: string;
  senderId: string;
  clientMessageId: string;
  body: string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  replyToMessageId?: string | null;
  replyPreviewBody?: string | null;
  replyPreviewSenderName?: string | null;
}
