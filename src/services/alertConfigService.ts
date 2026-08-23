/**
 * FertCalc Pro — Alert Config Service
 * CRUD para configurações de alertas/notificações por tipo de evento.
 */

import { supabase } from './supabase';

export interface AlertConfig {
  id: string;
  tipo: string;
  descricao: string;
  roles: string[];
  permissions: string[];
  recipientUserIds: string[];
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

type AlertConfigUpdate = {
  ativo?: boolean;
  roles?: string[];
  permissions?: string[];
  recipientUserIds?: string[];
};

function mapAlertConfig(row: Record<string, unknown>): AlertConfig {
  return {
    id: row.id as string,
    tipo: row.tipo as string,
    descricao: row.descricao as string,
    roles: (row.roles as string[]) ?? [],
    permissions: (row.permissions as string[]) ?? [],
    recipientUserIds: (row.recipient_user_ids as string[]) ?? [],
    ativo: row.ativo as boolean,
    criado_em: row.criado_em as string,
    atualizado_em: row.atualizado_em as string,
  };
}

export async function getAlertConfigs(): Promise<AlertConfig[]> {
  const { data, error } = await supabase.from('alert_configs').select('*').order('tipo');
  if (error || !data) {
    console.error('[alertConfigService] getAlertConfigs error:', error);
    return [];
  }
  return data.map(mapAlertConfig);
}

export async function updateAlertConfig(id: string, payload: AlertConfigUpdate): Promise<void> {
  const updatePayload: Record<string, unknown> = {
    atualizado_em: new Date().toISOString(),
  };
  if (payload.ativo !== undefined) updatePayload.ativo = payload.ativo;
  if (payload.roles !== undefined) updatePayload.roles = payload.roles;
  if (payload.permissions !== undefined) updatePayload.permissions = payload.permissions;
  if (payload.recipientUserIds !== undefined)
    updatePayload.recipient_user_ids = payload.recipientUserIds;

  const { error } = await supabase.from('alert_configs').update(updatePayload).eq('id', id);

  if (error) {
    console.error('[alertConfigService] updateAlertConfig error:', error);
    const msg = error.message ?? 'Erro ao atualizar configuração de alerta';
    const detail = error.code ? ` (código: ${error.code})` : '';
    throw new Error(msg + detail);
  }
}

export async function canReceiveSaldoPedidoAlert(userId: string, role: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('alert_configs')
    .select('ativo, roles, recipient_user_ids')
    .eq('tipo', 'saldo_pedido_antigo')
    .maybeSingle();
  if (error || !data || !data.ativo) return false;
  const roles = (data.roles as string[]) ?? [];
  const users = (data.recipient_user_ids as string[]) ?? [];
  return roles.includes(role) || users.includes(userId);
}
