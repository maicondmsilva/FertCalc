import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';
import { corsHeaders } from '../_shared/cors.ts';

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  if (!req.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return jsonResponse({ error: 'Content-Type must be application/json' }, 415);
  }

  try {
    const payload = (await req.json()) as { identifier?: string; password?: string };
    const identifier = payload.identifier?.trim().toLowerCase();
    const password = payload.password;
    if (!identifier || !password || identifier.length > 254 || password.length > 128) {
      return jsonResponse({ error: 'Invalid credentials' }, 401);
    }

    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const authClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profiles, error: profileError } = await admin
      .from('app_users')
      .select('email')
      .eq('nickname', identifier)
      .eq('ativo', true)
      .limit(2);
    if (profileError || profiles?.length !== 1) {
      return jsonResponse({ error: 'Invalid credentials' }, 401);
    }

    const { data, error } = await authClient.auth.signInWithPassword({
      email: profiles[0].email,
      password,
    });
    if (error || !data.session) {
      return jsonResponse({ error: 'Invalid credentials' }, 401);
    }

    return jsonResponse(
      {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
      200
    );
  } catch {
    return jsonResponse({ error: 'Invalid credentials' }, 401);
  }
});
