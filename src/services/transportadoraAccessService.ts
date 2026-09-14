import { supabase } from './supabase';

export interface UsuarioPortalTransportadora {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
}

export interface VinculoTransportadoraUsuario {
  id: string;
  organizationId: string;
  transportadoraId: string;
  userId: string;
  ativo: boolean;
}

export async function listarUsuariosPortalTransportadora(): Promise<UsuarioPortalTransportadora[]> {
  const { data, error } = await supabase
    .from('app_users')
    .select('id,name,email,ativo')
    .eq('role', 'transportadora')
    .order('name');
  if (error) throw error;
  return (data ?? []).map((item) => ({
    id: item.id,
    nome: item.name,
    email: item.email,
    ativo: Boolean(item.ativo),
  }));
}

export async function listarVinculosTransportadora(): Promise<VinculoTransportadoraUsuario[]> {
  const { data, error } = await supabase
    .from('transportadora_usuarios')
    .select('id,organization_id,transportadora_id,user_id,ativo');
  if (error) throw error;
  return (data ?? []).map((item) => ({
    id: item.id,
    organizationId: item.organization_id,
    transportadoraId: item.transportadora_id,
    userId: item.user_id,
    ativo: Boolean(item.ativo),
  }));
}

export async function vincularUsuarioTransportadora(input: {
  organizationId: string;
  transportadoraId: string;
  userId: string;
  criadoPor: string;
}): Promise<void> {
  const { error } = await supabase.from('transportadora_usuarios').upsert(
    {
      organization_id: input.organizationId,
      transportadora_id: input.transportadoraId,
      user_id: input.userId,
      ativo: true,
      criado_por: input.criadoPor,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}

export async function desativarVinculoTransportadora(id: string): Promise<void> {
  const { error } = await supabase
    .from('transportadora_usuarios')
    .update({ ativo: false, atualizado_em: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

