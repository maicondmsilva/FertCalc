import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type CreateUserPayload = {
  email?: string;
  password?: string;
  name?: string;
  nickname?: string;
  role?: string;
  ativo?: boolean;
  managed_user_ids?: string[];
  permissions?: Record<string, unknown>;
  filiais_permitidas?: string[];
  requer_alteracao_senha?: boolean;
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isWeakPassword(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('password') && (lower.includes('weak') || lower.includes('at least'));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  if (!req.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return jsonResponse({ error: 'Content-Type must be application/json' }, 415);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    const payload = (await req.json()) as CreateUserPayload;
    const email = payload.email?.trim().toLowerCase();
    const password = payload.password?.trim();
    const name = payload.name?.trim();
    const nickname = payload.nickname?.trim();
    const role = (payload.role?.trim() || 'user').toLowerCase();

    if (!email || !password || !name || !nickname) {
      return jsonResponse({ error: 'Campos obrigatórios: email, password, name e nickname' }, 422);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return jsonResponse({ error: 'E-mail inválido' }, 422);
    }

    if (password.length < 8 || password.length > 128) {
      return jsonResponse(
        { error: 'Senha fraca', code: 'weak_password', details: 'entre 8 e 128 caracteres' },
        422
      );
    }
    if (name.length > 120 || nickname.length > 80 || email.length > 254) {
      return jsonResponse({ error: 'Payload exceeds allowed field limits' }, 422);
    }
    if (
      (payload.managed_user_ids?.length ?? 0) > 200 ||
      (payload.filiais_permitidas?.length ?? 0) > 200
    ) {
      return jsonResponse({ error: 'Payload exceeds allowed collection limits' }, 422);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user: callerUser },
      error: callerError,
    } = await supabaseAdmin.auth.getUser(token);

    if (callerError || !callerUser) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const { data: canAssignRole, error: authorizationError } = await supabaseUser.rpc(
      'can_assign_role',
      { new_role: role }
    );
    if (authorizationError || !canAssignRole) {
      return jsonResponse({ error: 'Forbidden: admin privileges required' }, 403);
    }

    const { data: organizationId, error: organizationError } = await supabaseUser.rpc(
      'get_current_organization_id'
    );
    if (organizationError || !organizationId) {
      return jsonResponse({ error: 'Unable to resolve caller organization' }, 403);
    }

    const { data: createdAuth, error: createAuthError } = await supabaseAdmin.auth.admin.createUser(
      {
        email,
        password,
        email_confirm: true,
        user_metadata: { name, nickname, role },
      }
    );

    if (createAuthError || !createdAuth.user) {
      const message = createAuthError?.message ?? 'Erro ao criar usuário no autenticador';
      if (message.toLowerCase().includes('already') || message.toLowerCase().includes('exists')) {
        return jsonResponse({ error: 'E-mail já cadastrado', code: 'email_exists' }, 422);
      }
      if (isWeakPassword(message)) {
        return jsonResponse({ error: 'Senha fraca', code: 'weak_password' }, 422);
      }
      return jsonResponse({ error: 'Unable to create authentication user' }, 400);
    }

    const createdUserId = createdAuth.user.id;
    const { error: appUserError } = await supabaseAdmin.from('app_users').insert({
      id: createdUserId,
      organization_id: organizationId,
      email,
      name,
      nickname,
      role,
      ativo: payload.ativo ?? true,
      managed_user_ids: payload.managed_user_ids ?? [],
      permissions: payload.permissions ?? {},
      filiais_permitidas: payload.filiais_permitidas ?? [],
      requer_alteracao_senha: payload.requer_alteracao_senha ?? true,
      password: '', // satisfy legacy password column not-null constraint
    });

    if (appUserError) {
      await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      return jsonResponse(
        {
          error: 'Falha ao salvar perfil do usuário',
          code: 'app_user_create_failed',
        },
        500
      );
    }

    return jsonResponse({ user_id: createdUserId }, 200);
  } catch (err) {
    console.error('[admin-create-user] unexpected error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
