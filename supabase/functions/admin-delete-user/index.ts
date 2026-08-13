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

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    const { user_id } = (await req.json()) as { user_id?: string };
    if (!user_id?.trim()) {
      return jsonResponse({ error: 'user_id is required' }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
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

    // Verify caller role in app_users
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('app_users')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    if (profileError || !callerProfile) {
      return jsonResponse({ error: 'Forbidden: perfil não encontrado' }, 403);
    }

    // Check static admin roles OR dynamic hierarchy level
    let callerHierarchy = 0;
    const { data: hierarchyData, error: hierarchyError } = await supabaseAdmin
      .from('access_levels')
      .select('hierarchy_level')
      .eq('code', callerProfile.role)
      .maybeSingle();

    if (!hierarchyError && hierarchyData?.hierarchy_level != null) {
      callerHierarchy = Number(hierarchyData.hierarchy_level);
    }

    const hasStaticAdminRole =
      callerProfile.role === 'master' || callerProfile.role === 'admin';
    if (!hasStaticAdminRole && callerHierarchy < 80) {
      return jsonResponse({ error: 'Forbidden: admin privileges required' }, 403);
    }

    // Prevent self-deletion
    if (callerUser.id === user_id) {
      return jsonResponse({ error: 'Você não pode excluir sua própria conta.' }, 400);
    }

    // Verify target user exists and check hierarchy protection
    const { data: targetProfile } = await supabaseAdmin
      .from('app_users')
      .select('role')
      .eq('id', user_id)
      .single();

    if (targetProfile?.role === 'master' && callerProfile.role !== 'master') {
      return jsonResponse(
        { error: 'Apenas usuários Master podem excluir outros usuários Master.' },
        403
      );
    }

    // Delete from auth.users (this cascades or we handle app_users separately)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (deleteAuthError) {
      return jsonResponse({ error: deleteAuthError.message }, 400);
    }

    // Also ensure app_users row is removed (in case there's no cascade)
    await supabaseAdmin.from('app_users').delete().eq('id', user_id);

    return jsonResponse({ success: true }, 200);
  } catch (err) {
    console.error('[admin-delete-user] unexpected error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
