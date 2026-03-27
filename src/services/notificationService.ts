import { supabase } from './supabase';
import { getManagersOfUser } from './db';
import { PricingRecord, User } from '../types';
import { NotificationType, NotificationGroup, Notification } from '../types/notification.types';

interface NotificationPayload {
  user_id: string;
  type: string;
  group_type: string;
  title: string;
  message: string;
  action_url?: string;
  metadata?: any;
}

export const getNotifications = async (userId: string, limit: number = 20): Promise<Notification[]> => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }

  return (data ?? []) as Notification[];
};

export const markNotificationAsRead = async (notificationId: string, userId: string): Promise<void> => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

export const deleteAllNotifications = async (userId: string): Promise<void> => {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('Error clearing notifications:', error);
    throw error;
  }
};

export const saveNotification = async (notification: Omit<Notification, 'id' | 'created_at' | 'user_id'>, userId: string): Promise<Notification> => {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type: notification.type,
      group_type: notification.group_type,
      title: notification.title,
      message: notification.message,
      action_url: notification.action_url ?? null,
      is_read: false,
      metadata: notification.metadata ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving notification:', error);
    throw error;
  }

  return data as Notification;
};

export const createNotification = async (payload: NotificationPayload) => {
  try {
    const { error } = await supabase.from('notifications').insert(payload);
    if (error) console.error('Error creating notification:', error);
  } catch (err) {
    console.error('Exception creating notification:', err);
  }
};

export const notifyPricingCreated = async (pricing: PricingRecord, vendedor: User) => {
  const managers = await getManagersOfUser(vendedor.id);
  const clientName = pricing.factors?.client?.name || 'Cliente Desconhecido';
  
  for (const manager of managers) {
    await createNotification({
      user_id: manager.id,
      type: NotificationType.PRICING_CREATED,
      group_type: NotificationGroup.PRICING,
      title: 'Nova Precificação',
      message: `${vendedor.name} criou precificação para ${clientName}`,
      action_url: `/calculator?id=${pricing.id}`,
      metadata: { pricingId: pricing.id }
    });
  }
};

export const notifyPricingEdited = async (pricing: PricingRecord, vendedor: User) => {
  const managers = await getManagersOfUser(vendedor.id);
  const clientName = pricing.factors?.client?.name || 'Cliente Desconhecido';
  
  for (const manager of managers) {
    await createNotification({
      user_id: manager.id,
      type: NotificationType.PRICING_UPDATED,
      group_type: NotificationGroup.PRICING,
      title: 'Precificação Editada',
      message: `Precificação editada por ${vendedor.name} para o cliente ${clientName}`,
      action_url: `/calculator?id=${pricing.id}`,
      metadata: { pricingId: pricing.id }
    });
  }
};

export const notifyPricingDeleted = async (pricing: PricingRecord, vendedor: User) => {
  const managers = await getManagersOfUser(vendedor.id);
  const clientName = pricing.factors?.client?.name || 'Cliente Desconhecido';
  
  for (const manager of managers) {
    await createNotification({
      user_id: manager.id,
      type: NotificationType.PRICING_DELETED,
      group_type: NotificationGroup.PRICING,
      title: 'Precificação Deletada',
      message: `${vendedor.name} deletou precificação para ${clientName}`,
      metadata: { pricingId: pricing.id }
    });
  }
};

export const notifyTransferInitiated = async (pricing: PricingRecord, currentVendedor: User, targetVendorId: string, targetVendorName: string) => {
  // Notify the new vendor
  await createNotification({
    user_id: targetVendorId,
    type: 'TRANSFER_INITIATED',
    group_type: NotificationGroup.TRANSFER,
    title: 'Precificação Transferida',
    message: `Precificação transferida para você por ${currentVendedor.name}`,
    action_url: `/calculator?id=${pricing.id}`,
    metadata: { pricingId: pricing.id, fromUserId: currentVendedor.id }
  });

  // Notify the managers of the new vendor
  const managers = await getManagersOfUser(targetVendorId);
  for (const manager of managers) {
    await createNotification({
      user_id: manager.id,
      type: 'TRANSFER_INITIATED',
      group_type: NotificationGroup.TRANSFER,
      title: 'Transferência de Precificação',
      message: `${currentVendedor.name} transferiu precificação para ${targetVendorName}`,
      action_url: `/calculator?id=${pricing.id}`,
      metadata: { pricingId: pricing.id, targetVendorId }
    });
  }
};

export const notifyTransferAccepted = async (pricingId: string, acceptedByVendorName: string, originalVendorId: string) => {
  await createNotification({
    user_id: originalVendorId,
    type: NotificationType.TRANSFER_ACCEPTED,
    group_type: NotificationGroup.TRANSFER,
    title: 'Transferência Aceita',
    message: `${acceptedByVendorName} aceitou sua transferência de precificação`,
    metadata: { pricingId }
  });
};
