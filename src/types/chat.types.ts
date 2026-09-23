export interface ChatContact {
  id: string;
  name: string;
  nickname?: string | null;
  role: string;
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
}

export interface ChatMessageReceipt {
  messageId: string;
  readByCount: number;
  recipientCount: number;
  fullyRead: boolean;
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
}
