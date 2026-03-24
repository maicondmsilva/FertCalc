import { supabase } from './supabase';
import { getManagersOfUser } from './db';
import { PricingRecord, User } from '../types';
import { NotificationType, NotificationGroup } from '../types/notification.types';

interface NotificationPayload {
  user_id: string;
  type: string;
  group_type: string;
  title: string;
  message: string;
  action_url?: string;
  metadata?: any;
}

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
