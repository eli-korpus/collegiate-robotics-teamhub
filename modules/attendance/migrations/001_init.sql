-- Attendance (spec §13.1): presence only. Absence is implied; percentages are computed, never stored.
create table att_sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams (id) on delete cascade,
  date date not null default current_date,
  starts_at timestamptz,
  ends_at timestamptz,
  title text check (char_length(title) <= 120),
  season text not null default teamhub_season(),
  closed boolean not null default false,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index att_sessions_date_idx on att_sessions (date);

create table att_presence (
  session_id uuid not null references att_sessions (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  check_in timestamptz,
  check_out timestamptz,
  primary key (session_id, user_id)
);
create index att_presence_user_idx on att_presence (user_id);

-- Ephemeral rotating check-in codes (pruned by cron, deleted when a session closes).
create table att_codes (
  session_id uuid primary key references att_sessions (id) on delete cascade,
  code text not null,
  expires_at timestamptz not null
);

create or replace function att_can_take(p_session uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from att_sessions s where s.id = p_session and teamhub_can('attendance.take', s.team_id))
$$;

create or replace function att_rotate_code(p_session uuid, p_seconds int default 30) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c text := lpad(floor(random() * 10000)::int::text, 4, '0'); exp timestamptz := now() + make_interval(secs => greatest(p_seconds, 10) + 15);
begin
  if not att_can_take(p_session) then raise exception 'Only people who take attendance can show the code' using errcode = '42501'; end if;
  if exists (select 1 from att_sessions where id = p_session and closed) then raise exception 'This session is closed'; end if;
  insert into att_codes (session_id, code, expires_at) values (p_session, c, exp)
  on conflict (session_id) do update set code = excluded.code, expires_at = excluded.expires_at;
  return jsonb_build_object('code', c, 'expires_at', exp);
end $$;

create or replace function att_check_in(p_session uuid, p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare s att_sessions;
begin
  select * into s from att_sessions where id = p_session;
  if not found then raise exception 'Practice session not found'; end if;
  if s.closed then raise exception 'This practice has already ended'; end if;
  if not teamhub_can('attendance.self_check_in', s.team_id) then raise exception 'Self check-in is not allowed for you' using errcode = '42501'; end if;
  if s.team_id is not null and not exists (
    select 1 from memberships where user_id = auth.uid() and team_id = s.team_id and status = 'active') then
    raise exception 'You are not on this team';
  end if;
  if not exists (select 1 from att_codes where session_id = p_session and code = trim(p_code) and expires_at > now()) then
    raise exception 'That code is wrong or has expired. Use the one on the screen now';
  end if;
  insert into att_presence (session_id, user_id, check_in) values (p_session, auth.uid(), now())
  on conflict (session_id, user_id) do update set check_in = coalesce(att_presence.check_in, excluded.check_in);
  return 'checked_in';
end $$;

create or replace function att_check_out(p_session uuid) returns void
language sql security definer set search_path = public as $$
  update att_presence set check_out = now()
  where session_id = p_session and user_id = auth.uid() and check_out is null
    and exists (select 1 from att_sessions where id = p_session and not closed)
$$;

-- End a session: remove the code; optionally check everyone out (hours mode).
create or replace function att_close(p_session uuid, p_check_out boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not att_can_take(p_session) then raise exception 'Not allowed' using errcode = '42501'; end if;
  delete from att_codes where session_id = p_session;
  update att_sessions set closed = true, ends_at = coalesce(ends_at, now()) where id = p_session;
  if p_check_out then
    update att_presence set check_out = now() where session_id = p_session and check_in is not null and check_out is null;
  end if;
end $$;

select teamhub_realtime_add('att_presence');
