import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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

    const { user_id } = (await req.json()) as { user_id?: string };
    if (
      !user_id?.trim() ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(user_id)
    ) {
      return jsonResponse({ error: 'valid user_id is required' }, 422);
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

    // Verify caller identity
    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user: callerUser },
      error: callerError,
    } = await supabaseAdmin.auth.getUser(token);

    if (callerError || !callerUser) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const { data: canDelete, error: authorizationError } = await supabaseUser.rpc(
      'can_delete_user',
      { target_user_id: user_id }
    );
    if (authorizationError || !canDelete) {
      return jsonResponse({ error: 'Forbidden: sem permissão para excluir este usuário' }, 403);
    }

    // Delete from auth.users (this cascades or we handle app_users separately)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (deleteAuthError) {
      return jsonResponse({ error: 'Unable to delete user' }, 400);
    }

    // Also ensure app_users row is removed (in case there's no cascade)
    await supabaseAdmin.from('app_users').delete().eq('id', user_id);

    return jsonResponse({ success: true }, 200);
  } catch (err) {
    console.error('[admin-delete-user] unexpected error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
