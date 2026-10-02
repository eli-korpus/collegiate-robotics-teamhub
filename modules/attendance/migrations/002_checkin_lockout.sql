-- Brute-force protection for self check-in: 5 wrong codes per person per practice locks them out of self check-in
-- for that practice (the person taking attendance can still mark them present).
create table att_attempts (
  session_id uuid not null references att_sessions (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  failures smallint not null default 0,
  primary key (session_id, user_id)
);
alter table att_attempts enable row level security;
-- No client policies: only att_check_in() touches it.

create or replace function att_check_in(p_session uuid, p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare s att_sessions; tries int;
begin
  select * into s from att_sessions where id = p_session;
  if not found then raise exception 'Practice session not found'; end if;
  if s.closed then raise exception 'This practice has already ended'; end if;
  if not teamhub_can('attendance.self_check_in', s.team_id) then raise exception 'Self check-in is not allowed for you' using errcode = '42501'; end if;
  if s.team_id is not null and not exists (
    select 1 from memberships where user_id = auth.uid() and team_id = s.team_id and status = 'active') then
    raise exception 'You are not on this team';
  end if;
  select failures into tries from att_attempts where session_id = p_session and user_id = auth.uid();
  if coalesce(tries, 0) >= 5 then
    raise exception 'Too many wrong codes — ask the person taking attendance to check you in' using errcode = '42501';
  end if;
  if not exists (select 1 from att_codes where session_id = p_session and code = trim(p_code) and expires_at > now()) then
    insert into att_attempts (session_id, user_id, failures) values (p_session, auth.uid(), 1)
    on conflict (session_id, user_id) do update set failures = att_attempts.failures + 1;
    -- Return instead of raising so the failure count is committed.
    return 'wrong_code';
  end if;
  insert into att_presence (session_id, user_id, check_in) values (p_session, auth.uid(), now())
  on conflict (session_id, user_id) do update set check_in = coalesce(att_presence.check_in, excluded.check_in);
  return 'checked_in';
end $$;
