// Deletes a person's login (spec §7.5). Pending people disappear; everyone else is anonymized to "Former member"
// by a database trigger so their contributions stay attributed. Caller permission is checked with their own JWT.
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
    const { user_id } = await req.json();
    if (!user_id) return json({ error: 'user_id required' }, 400);

    const url = Deno.env.get('SUPABASE_URL')!;
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: allowed, error: permError } = await caller.rpc('people_can_delete_user', { p_user: user_id });
    if (permError) return json({ error: permError.message }, 400);
    if (!allowed) return json({ error: "You don't have permission to delete this account." }, 403);

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data: profile } = await admin.from('profiles').select('avatar_path').eq('id', user_id).maybeSingle();
    if (profile?.avatar_path) await admin.storage.from('avatars').remove([profile.avatar_path]);
    const { error } = await admin.auth.admin.deleteUser(user_id);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
