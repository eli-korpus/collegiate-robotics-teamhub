// Generates a one-time password recovery link for a person (spec §7.5). No email is sent:
// a mentor/admin copies the link and gives it to the person. Caller permission is checked with their own JWT.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Not signed in' }, 401);
    const { user_id, redirect_to } = await req.json();
    if (!user_id) return json({ error: 'user_id required' }, 400);

    const url = Deno.env.get('SUPABASE_URL')!;
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: allowed, error: permError } = await caller.rpc('people_can_reset_password', { p_user: user_id });
    if (permError) return json({ error: permError.message }, 400);
    if (!allowed) return json({ error: "You don't have permission to reset this person's password." }, 403);

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data: user, error: userError } = await admin.auth.admin.getUserById(user_id);
    if (userError || !user.user?.email) return json({ error: 'User not found' }, 404);
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: user.user.email,
      options: redirect_to ? { redirectTo: redirect_to } : undefined,
    });
    if (error) return json({ error: error.message }, 400);
    return json({ link: data.properties.action_link });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
