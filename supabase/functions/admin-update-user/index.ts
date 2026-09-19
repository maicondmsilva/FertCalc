import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type Payload = {
  user_id?: string;
  email?: string;
  name?: string;
  nickname?: string;
  role?: string;
  ativo?: boolean;
  managed_user_ids?: string[];
  permissions?: Record<string, unknown>;
  filiais_permitidas?: string[];
  access_profile_id?: string;
};

const response = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return response({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return response({ error: 'Missing Authorization header' }, 401);
    const payload = (await req.json()) as Payload;
    const userId = payload.user_id?.trim();
    const email = payload.email?.trim().toLowerCase();
    const name = payload.name?.trim();
    const nickname = payload.nickname?.trim();
    const role = payload.role?.trim().toLowerCase();
    if (!userId || !email || !name || !nickname || !role) {
      return response({ error: 'Dados obrigatórios do usuário não informados' }, 422);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return response({ error: 'E-mail inválido' }, 422);
    }

    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: callerAuth, error: callerError } = await admin.auth.getUser(token);
    if (callerError || !callerAuth.user) return response({ error: 'Unauthorized' }, 401);

    const [manageDecision, roleDecision] = await Promise.all([
      caller.rpc('can_manage_user', { target_user_id: userId }),
      caller.rpc('can_assign_role', { new_role: role }),
    ]);
    if (
      manageDecision.error ||
      roleDecision.error ||
      !manageDecision.data ||
      !roleDecision.data
    ) {
      return response({ error: 'Sem permissão para editar este usuário ou atribuir este nível' }, 403);
    }

    const { data: currentProfile, error: profileError } = await admin
      .from('app_users')
      .select('organization_id,email,name,nickname')
      .eq('id', userId)
      .single();
    if (profileError || !currentProfile) return response({ error: 'Usuário não encontrado' }, 404);

    const { data: callerOrganization } = await caller.rpc('get_current_organization_id');
    if (!callerOrganization || currentProfile.organization_id !== callerOrganization) {
      return response({ error: 'Usuário fora da organização atual' }, 403);
    }

    const { data: oldAuth, error: oldAuthError } = await admin.auth.admin.getUserById(userId);
    if (oldAuthError || !oldAuth.user) return response({ error: 'Usuário não encontrado no Auth' }, 404);

    const previousMetadata = oldAuth.user.user_metadata ?? {};
    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      email,
      email_confirm: true,
      user_metadata: { ...previousMetadata, name, nickname },
    });
    if (authError) {
      const duplicate = /already|exists|registered/i.test(authError.message);
      return response({ error: duplicate ? 'Este e-mail já está cadastrado no Auth' : authError.message }, duplicate ? 409 : 400);
    }

    const { error: appError } = await admin
      .from('app_users')
      .update({
        email,
        name,
        nickname,
        role,
        ativo: payload.ativo ?? true,
        managed_user_ids: payload.managed_user_ids ?? [],
        permissions: payload.permissions ?? {},
        filiais_permitidas: payload.filiais_permitidas ?? [],
        access_profile_id: payload.access_profile_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (appError) {
      await admin.auth.admin.updateUserById(userId, {
        email: oldAuth.user.email,
        email_confirm: true,
        user_metadata: previousMetadata,
      });
      return response({ error: `Falha ao atualizar cadastro interno: ${appError.message}` }, 500);
    }

    return response({ user_id: userId }, 200);
  } catch (error) {
    console.error('[admin-update-user] unexpected error:', error);
    return response({ error: 'Internal server error' }, 500);
  }
});
