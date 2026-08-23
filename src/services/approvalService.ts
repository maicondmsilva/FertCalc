import type { PricingHistoryEntry, PricingRecord, User } from '../types';
import { createNotification, updatePricingRecord } from './db';
import { logAudit } from './auditService';
import { logger } from '../utils/logger';

export type PricingApprovalStatus = 'Aprovada' | 'Reprovada';

interface ProcessPricingApprovalInput {
  pricing: PricingRecord;
  status: PricingApprovalStatus;
  reason?: string;
  approver: User;
  now?: Date;
}

export async function processPricingApproval({
  pricing,
  status,
  reason = '',
  approver,
  now = new Date(),
}: ProcessPricingApprovalInput): Promise<PricingHistoryEntry> {
  const rejectionReason = status === 'Reprovada' ? reason.trim() : '';
  const historyEntry: PricingHistoryEntry = {
    date: now.toISOString(),
    userId: approver.id,
    userName: approver.name,
    action: `Precificação ${status}${rejectionReason ? `: ${rejectionReason}` : ''}`,
  };

  await updatePricingRecord(pricing.id, {
    approvalStatus: status,
    rejectionObservation: rejectionReason,
    history: [...(pricing.history ?? []), historyEntry],
  });

  const notificationResult = await Promise.allSettled([
    createNotification({
      userId: pricing.userId,
      title: `Precificação ${status === 'Aprovada' ? 'Aprovada ✅' : 'Reprovada ❌'}`,
      message: `Sua precificação para ${pricing.factors?.client?.name || 'Cliente'} foi ${status.toLowerCase()}.${rejectionReason ? ` Motivo: ${rejectionReason}` : ''}`,
      date: now.toISOString(),
      read: false,
      type: 'pricing_approval',
    }),
    logAudit({
      user_id: approver.id,
      user_name: approver.name,
      action: status === 'Aprovada' ? 'pricing.approved' : 'pricing.rejected',
      entity_type: 'pricing_record',
      entity_id: pricing.id,
      metadata: {
        client: pricing.factors?.client?.name,
        formattedCod: pricing.formattedCod,
        reason: rejectionReason || undefined,
      },
    }),
  ]);

  if (notificationResult[0].status === 'rejected') {
    logger.warn('Falha ao enviar notificação de aprovação:', notificationResult[0].reason);
  }

  return historyEntry;
}
