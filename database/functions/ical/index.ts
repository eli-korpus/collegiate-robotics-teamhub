// Public iCal feed for families (spec §13.2): /functions/v1/ical?token=<secret>. No account needed;
// the token is a per-program or per-team secret that admins can rotate. Deployed only when Calendar is enabled.
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('token');
  if (!token || token.length < 32) return new Response('Missing token', { status: 400 });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data, error } = await sb.rpc('cal_ical', { p_token: token });
  if (error) return new Response('Feed unavailable', { status: 500 });
  if (!data) return new Response('Unknown or rotated feed link', { status: 404 });
  return new Response(data as string, {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'public, max-age=900', 'Content-Disposition': 'inline; filename="team.ics"' },
  });
});
