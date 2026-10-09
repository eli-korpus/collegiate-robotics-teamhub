-- Check-in codes come from the secure random generator behind gen_random_uuid() instead of random(), whose values
-- can be predicted, and a code lasts at most 5 minutes. Same as 001_init otherwise.
create or replace function att_rotate_code(p_session uuid, p_seconds int default 30) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c text := lpad(((('x' || lpad(left(replace(gen_random_uuid()::text, '-', ''), 8), 16, '0'))::bit(64)::bigint) % 10000)::text, 4, '0');
  exp timestamptz := now() + make_interval(secs => least(greatest(coalesce(p_seconds, 30), 10), 300) + 15);
begin
  if not att_can_take(p_session) then raise exception 'Only people who take attendance can show the code' using errcode = '42501'; end if;
  if exists (select 1 from att_sessions where id = p_session and closed) then raise exception 'This session is closed'; end if;
  insert into att_codes (session_id, code, expires_at) values (p_session, c, exp)
  on conflict (session_id) do update set code = excluded.code, expires_at = excluded.expires_at;
  return jsonb_build_object('code', c, 'expires_at', exp);
end $$;
