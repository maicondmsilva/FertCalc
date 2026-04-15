export enum NotificationGroup {
  PRICING = 'PRICING',
  TRANSFER = 'TRANSFER',
  SYSTEM = 'SYSTEM',
  CARREGAMENTO = 'CARREGAMENTO',
}

export enum NotificationType {
  PRICING_CREATED = 'PRICING_CREATED',
  PRICING_UPDATED = 'PRICING_UPDATED',
  PRICING_DELETED = 'PRICING_DELETED',
  TRANSFER_ACCEPTED = 'TRANSFER_ACCEPTED',
  SYSTEM_INFO = 'SYSTEM_INFO',
  COTACAO_SOLICITADA = 'COTACAO_SOLICITADA',
  COTACAO_DISPONIVEL = 'COTACAO_DISPONIVEL',
}

export interface NotificationPayload {
  [key: string]: unknown;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType | string;
  group_type: NotificationGroup | string;
  title: string;
  message: string;
  action_url?: string;
  is_read: boolean;
  created_at: string;
  metadata?: NotificationPayload;
}

export interface NotificationPreferences {
  user_id: string;
  email_enabled: boolean;
  push_enabled: boolean;
  in_app_enabled: boolean;
  sound_enabled?: boolean;
  desktop_enabled?: boolean;
  disabled_types: string[];
  updated_at: string;
}
