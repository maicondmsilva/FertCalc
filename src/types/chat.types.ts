export interface ChatContact {
  id: string;
  name: string;
  nickname?: string | null;
  role: string;
}

export interface ChatConversation {
  conversationId: string;
  contactId: string;
  contactName: string;
  contactNickname?: string | null;
  contactRole: string;
  lastMessageBody?: string | null;
  lastMessageSenderId?: string | null;
  lastMessageAt?: string | null;
  unreadCount: number;
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
