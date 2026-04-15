/**
 * FertCalc Pro — Audit Log Service (Carregamentos)
 *
 * Registra e recupera o histórico de modificações e exclusões
 * no módulo de carregamento (carregamentos e cotações_solicitadas).
 * Usa a tabela `audit_log` com dados_anteriores/dados_novos.
 */

import { supabase } from './supabase';

export interface AuditLogCarregamento {
  id?: string;
  tabela: 'carregamentos' | 'cotacoes_solicitadas';
  registro_id: string;
  acao: 'INSERT' | 'UPDATE' | 'DELETE';
  dados_anteriores?: Record<string, unknown> | null;
  dados_novos?: Record<string, unknown> | null;
  campos_alterados?: string[];
  motivo?: string;
  usuario_id: string;
  usuario_nome: string;
  criado_em?: string;
}

function calcularCamposAlterados(
  anterior: Record<string, unknown> | null | undefined,
  novo: Record<string, unknown> | null | undefined
): string[] {
  if (!anterior || !novo) return [];
  return Object.keys(novo).filter(
    (key) => JSON.stringify(anterior[key]) !== JSON.stringify(novo[key])
  );
}

export async function registrarAuditLog(
  entry: Omit<AuditLogCarregamento, 'id' | 'criado_em'>
): Promise<void> {
  try {
    const camposAlterados =
      entry.campos_alterados ?? calcularCamposAlterados(entry.dados_anteriores, entry.dados_novos);

    const { error } = await supabase.from('audit_log').insert([
      {
        tabela: entry.tabela,
        registro_id: entry.registro_id,
        acao: entry.acao,
        dados_anteriores: entry.dados_anteriores ?? null,
        dados_novos: entry.dados_novos ?? null,
        campos_alterados: camposAlterados.length > 0 ? camposAlterados : null,
        motivo: entry.motivo ?? null,
        usuario_id: entry.usuario_id,
        usuario_nome: entry.usuario_nome,
      },
    ]);

    if (error) {
      console.error('[auditLogService] Erro ao registrar audit log:', error);
      // Não lançar erro — não bloquear a operação principal
    }
  } catch (err) {
    console.error('[auditLogService] Exceção ao registrar audit log:', err);
  }
}

export async function getAuditLog(
  tabela: 'carregamentos' | 'cotacoes_solicitadas',
  registroId: string
): Promise<AuditLogCarregamento[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('tabela', tabela)
    .eq('registro_id', registroId)
    .order('criado_em', { ascending: false });

  if (error) {
    console.error('[auditLogService] Erro ao buscar audit log:', error);
    return [];
  }
  return (data ?? []) as AuditLogCarregamento[];
}
