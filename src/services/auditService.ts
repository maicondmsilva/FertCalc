/**
 * FertCalc Pro — Audit Service
 *
 * Registra ações críticas na tabela `audit_logs` para rastreabilidade.
 * Ações como aprovação/reprovação de precificação, exclusão, transferência
 * e alterações de status ficam registradas de forma imutável.
 */

import { supabase } from './supabase';
import { logger } from '../utils/logger';

export interface AuditLogEntry {
  user_id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata?: Record<string, unknown>;
}

/**
 * Registra uma entrada no log de auditoria.
 *
 * @example
 * await logAudit({
 *   user_id: currentUser.id,
 *   user_name: currentUser.name,
 *   action: 'pricing.approved',
 *   entity_type: 'pricing_record',
 *   entity_id: pricingId,
 *   metadata: { status: 'approved', approver: currentUser.name }
 * });
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      user_id: entry.user_id,
      user_name: entry.user_name,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      metadata: entry.metadata ?? null,
    });

    if (error) {
      logger.error('[auditService] Erro ao gravar log de auditoria:', error);
    }
  } catch (err) {
    // Falha no audit log não deve interromper a operação principal
    logger.error('[auditService] Exceção ao gravar audit log:', err);
  }
}

/**
 * Busca logs de auditoria com filtros opcionais.
 * Apenas admin/master têm acesso (controlado via RLS).
 */
export async function getAuditLogs(filters?: {
  entity_type?: string;
  entity_id?: string;
  action?: string;
  user_id?: string;
  limit?: number;
}): Promise<AuditLogEntry[]> {
  try {
    let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false });

    if (filters?.entity_type) query = query.eq('entity_type', filters.entity_type);
    if (filters?.entity_id) query = query.eq('entity_id', filters.entity_id);
    if (filters?.action) query = query.eq('action', filters.action);
    if (filters?.user_id) query = query.eq('user_id', filters.user_id);
    query = query.limit(filters?.limit ?? 100);

    const { data, error } = await query;
    if (error) {
      logger.error('[auditService] Erro ao buscar audit logs:', error);
      return [];
    }
    return data ?? [];
  } catch (err) {
    logger.error('[auditService] Exceção ao buscar audit logs:', err);
    return [];
  }
}
