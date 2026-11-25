import { supabase } from './supabase';
import { agentToDb, clientToDb, mapAgent, mapClient } from './db';
import type { Agent, Client } from '../types';

/**
 * Cadastro de clientes e agentes (representantes). Diferente de getClients /
 * getAgents (usados nas calculadoras, que seguem sem lista em erro), aqui o erro
 * sobe: a tela mostra o aviso em vez de "nenhum cadastro". O código sequencial
 * é gerado pelo banco (sem corrida entre dois cadastros) e não muda na edição.
 */
export async function listClients(): Promise<Client[]> {
  const { data, error } = await supabase.from('clients').select('*').order('name');
  if (error) throw error;
  return (data || []).map(mapClient);
}

export async function listAgents(): Promise<Agent[]> {
  const { data, error } = await supabase.from('agents').select('*').order('name');
  if (error) throw error;
  return (data || []).map(mapAgent);
}

type ClientDraft = Omit<Client, 'id' | 'code' | 'organizationId'>;
type AgentDraft = Omit<Agent, 'id' | 'code' | 'organizationId'>;

export async function saveClient(draft: ClientDraft, id?: string): Promise<void> {
  const payload = clientToDb(draft);
  delete payload.code;
  const { error } = id
    ? await supabase
        .from('clients')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
    : await supabase.from('clients').insert({ ...payload, code: '' });
  if (error) throw error;
}

export async function saveAgent(draft: AgentDraft, id?: string): Promise<void> {
  const payload = agentToDb(draft);
  delete payload.code;
  const { error } = id
    ? await supabase
        .from('agents')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
    : await supabase.from('agents').insert({ ...payload, code: '' });
  if (error) throw error;
}

/** Exclui e confere que apagou (RLS pode bloquear sem erro). */
export async function removeRegistry(kind: 'clients' | 'agents', id: string): Promise<void> {
  const { data, error } = await supabase.from(kind).delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Sem permissão para excluir este cadastro.');
}

/** Pedidos de venda ligados ao cliente (o vínculo some se ele for excluído). */
export async function countClientOrders(clientId: string): Promise<number> {
  // Vai dentro de um filtro do PostgREST: aceita só UUID.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) return 0;
  const { count, error } = await supabase
    .from('pedidos_venda')
    .select('id', { count: 'exact', head: true })
    .or(`cliente_id.eq.${clientId},cliente_id_novo.eq.${clientId}`);
  if (error) return 0;
  return count ?? 0;
}
