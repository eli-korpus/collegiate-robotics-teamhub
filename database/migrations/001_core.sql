-- TeamHub FTC core schema (spec §8). Expand-only: never rename or drop in later migrations.

-- ── System tables ───────────────────────────────────────────────────────────
create table if not exists teamhub_modules (
  id text primary key,
  version int not null,
  state text not null check (state in ('active', 'dormant')),
  updated_at timestamptz not null default now()
);

create table if not exists teamhub_settings (
  id int primary key default 1 check (id = 1),
  season_label text not null,
  last_keepalive timestamptz,
  storage_limits jsonb not null default '{"db_mb": 500, "files_mb": 1024}',
  storage_history jsonb not null default '[]',
  extra_profile_fields jsonb not null default '[]'
);

-- Paths of storage objects to delete (Postgres cannot delete storage objects itself; edge function `cleanup` does).
create table if not exists teamhub_storage_trash (
  id bigint generated always as identity primary key,
  bucket text not null,
  path text not null,
  created_at timestamptz not null default now()
);

create schema if not exists teamhub_private;
create table if not exists teamhub_private.config (key text primary key, value text not null);
revoke all on schema teamhub_private from public;

-- ── People ──────────────────────────────────────────────────────────────────
create table if not exists teams (
  id uuid primary key,
  number int,
  name text not null,
  short_code text not null,
  color text not null,
  sort int not null default 0,
  archived boolean not null default false
);

create table if not exists profiles (
  id uuid primary key,
  display_name text not null,
  avatar_path text,
  is_admin boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'active', 'inactive')),
  details jsonb not null default '{}',
  home_prefs jsonb,
  created_at timestamptz not null default now()
);

-- Private extended fields (emergency contacts …). Separate table so RLS hides it completely (spec §8 private_details).
create table if not exists profiles_private (
  user_id uuid primary key references profiles (id) on delete cascade,
  data jsonb not null default '{}'
);

create table if not exists memberships (
  user_id uuid not null references profiles (id) on delete cascade,
  team_id uuid not null references teams (id) on delete cascade,
  type text not null check (type in ('member', 'captain', 'mentor')),
  status text not null default 'pending' check (status in ('pending', 'active', 'inactive')),
  requested_type text check (requested_type in ('member', 'captain', 'mentor')),
  note text check (char_length(note) <= 300),
  approved_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, team_id)
);
create index if not exists memberships_team_idx on memberships (team_id);

create table if not exists positions (
  id text primary key,
  name text not null,
  team_id uuid references teams (id) on delete cascade,
  grants_permissions boolean not null default false,
  source text not null default 'app' check (source in ('config', 'app'))
);

create table if not exists position_holders (
  position_id text not null references positions (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  team_id uuid references teams (id) on delete cascade,
  primary key (position_id, user_id)
);
create index if not exists position_holders_user_idx on position_holders (user_id);

create table if not exists subteams (
  id text primary key,
  name text not null,
  sort int not null default 0
);

-- THE ONLY links table (spec §8, §10.6).
create table if not exists links (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) <= 80),
  url text not null check (url ~* '^https?://'),
  description text check (char_length(description) <= 300),
  slot text,
  section text,
  team_id uuid references teams (id) on delete cascade,
  sort int not null default 0,
  created_by uuid references profiles (id) on delete set null
);

create table if not exists info_requests (
  id uuid primary key default gen_random_uuid(),
  fields text[] not null,
  team_id uuid references teams (id) on delete cascade,
  message text check (char_length(message) <= 500),
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  closes_at timestamptz
);

create table if not exists notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles (id) on delete cascade,
  type text not null,
  ref text not null,
  actor uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_user_read_idx on notifications (user_id, read_at);

create table if not exists comments (
  id bigint generated always as identity primary key,
  ref text not null,
  author uuid references profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists comments_ref_idx on comments (ref);

-- ── Identity helpers ────────────────────────────────────────────────────────
create or replace function teamhub_uid() returns uuid
language sql stable as $$ select auth.uid() $$;

create or replace function teamhub_is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'active')
$$;

create or replace function teamhub_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and is_admin and status = 'active')
$$;

-- Caller can see content scoped to p_team (null = program-wide).
create or replace function teamhub_in_team(p_team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select teamhub_is_admin() or (
    teamhub_is_active() and (
      p_team is null or exists (
        select 1 from memberships where user_id = auth.uid() and team_id = p_team and status = 'active'
      )
    )
  )
$$;

create or replace function teamhub_has_type(p_team uuid, p_types text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select teamhub_is_active() and exists (
    select 1 from memberships
    where user_id = auth.uid() and status = 'active' and type = any (p_types)
      and (p_team is null or team_id = p_team)
  )
$$;

create or replace function teamhub_has_position(p_team uuid, p_positions text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select teamhub_is_active() and exists (
    select 1 from position_holders
    where user_id = auth.uid() and position_id = any (p_positions)
      and (p_team is null or team_id is null or team_id = p_team)
  )
$$;

-- Replaced by the generator with the compiled permission matrix (spec §7.4).
create or replace function teamhub_can(perm text, p_team uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select teamhub_is_admin()
$$;

-- Replaced by the generator: who holds a permission (used for routing notifications).
create or replace function teamhub_users_with(perm text, p_team uuid default null) returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from profiles where is_admin and status = 'active'
$$;

-- Replaced by the generator: can the caller see the item an entity ref points to? (comments, notifications)
create or replace function teamhub_ref_visible(p_ref text) returns boolean
language sql stable security definer set search_path = public as $$
  select false
$$;

create or replace function teamhub_season() returns text
language sql stable security definer set search_path = public as $$
  select season_label from teamhub_settings where id = 1
$$;

-- `<team_id|program>/<entity>/<file>` → team id or null.
create or replace function teamhub_path_team(p_name text) returns uuid
language sql immutable as $$
  select case when split_part(p_name, '/', 1) ~ '^[0-9a-f-]{36}$' then split_part(p_name, '/', 1)::uuid else null end
$$;

-- Insert notifications for real recipients only, never notifying the actor (spec §10.5).
create or replace function teamhub_notify(p_users uuid[], p_type text, p_ref text) returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, type, ref, actor)
  select distinct u, p_type, p_ref, auth.uid()
  from unnest(p_users) as u
  join profiles p on p.id = u and p.status = 'active'
  where u is distinct from auth.uid()
$$;

create or replace function teamhub_trash(p_bucket text, p_paths text[]) returns void
language sql security definer set search_path = public as $$
  insert into teamhub_storage_trash (bucket, path) select p_bucket, x from unnest(p_paths) x where x is not null
$$;

-- Adds a table to the realtime publication when it exists (no-op locally).
create or replace function teamhub_realtime_add(p_table text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = p_table) then
    execute format('alter publication supabase_realtime add table public.%I', p_table);
  end if;
end $$;

-- ── Module lifecycle helpers (called only by migration plans, never by clients) ──
create or replace function teamhub_drop_policies(p_prefix text) returns void
language plpgsql as $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where (schemaname = 'public' and starts_with(tablename, p_prefix))
       or starts_with(policyname, p_prefix)
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

create or replace function teamhub_make_dormant(p_prefix text) returns void
language plpgsql as $$
declare r record;
begin
  perform teamhub_drop_policies(p_prefix);
  for r in select tablename from pg_tables where schemaname = 'public' and starts_with(tablename, p_prefix) loop
    execute format('create policy %I on public.%I for select to authenticated using (teamhub_is_admin())',
      left(r.tablename, 40) || '_dormant_read', r.tablename);
  end loop;
end $$;

create or replace function teamhub_drop_prefix(p_prefix text) returns void
language plpgsql as $$
declare r record;
begin
  perform teamhub_drop_policies(p_prefix);
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    execute format('select cron.unschedule(jobname) from cron.job where starts_with(jobname, %L)', p_prefix);
  end if;
  for r in select viewname from pg_views where schemaname = 'public' and starts_with(viewname, p_prefix) loop
    execute format('drop view if exists public.%I cascade', r.viewname);
  end loop;
  for r in select tablename from pg_tables where schemaname = 'public' and starts_with(tablename, p_prefix) loop
    execute format('drop table if exists public.%I cascade', r.tablename);
  end loop;
  for r in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and starts_with(p.proname, p_prefix)
  loop
    execute format('drop function if exists %s cascade', r.sig);
  end loop;
end $$;

-- ── Profile guards ──────────────────────────────────────────────────────────
-- Clients may edit their own name/avatar/details/home layout, never status or admin flag.
create or replace function teamhub_profiles_guard() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.id <> old.id or new.is_admin <> old.is_admin or new.status <> old.status or new.created_at <> old.created_at then
      raise exception 'You cannot change this field directly' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard on profiles;
create trigger profiles_guard before update on profiles for each row execute function teamhub_profiles_guard();

-- A program must always keep at least one active admin (spec §7.2).
create or replace function teamhub_keep_one_admin() returns trigger
language plpgsql as $$
begin
  if (tg_op = 'DELETE' and old.is_admin) or
     (tg_op = 'UPDATE' and old.is_admin and old.status = 'active' and (not new.is_admin or new.status <> 'active')) then
    if not exists (select 1 from profiles where is_admin and status = 'active' and id <> old.id) then
      raise exception 'TeamHub needs at least one admin. Make someone else an admin first.' using errcode = 'P0001';
    end if;
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists profiles_keep_admin on profiles;
create trigger profiles_keep_admin before update or delete on profiles for each row execute function teamhub_keep_one_admin();

-- ── Signup → pending (spec §7.5) ────────────────────────────────────────────
create or replace function teamhub_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}');
  req text := coalesce(meta->>'requested_type', 'member');
  t text;
begin
  if req not in ('member', 'captain', 'mentor') then req := 'member'; end if;
  insert into profiles (id, display_name, status)
  values (new.id, left(coalesce(nullif(trim(meta->>'name'), ''), split_part(new.email, '@', 1)), 80), 'pending')
  on conflict (id) do nothing;
  if jsonb_typeof(meta->'teams') = 'array' then
    for t in select jsonb_array_elements_text(meta->'teams') loop
      if exists (select 1 from teams where id::text = t and not archived) then
        insert into memberships (user_id, team_id, type, status, requested_type, note)
        values (new.id, t::uuid, req, 'pending', req, left(meta->>'note', 300))
        on conflict do nothing;
      end if;
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists teamhub_on_auth_user_created on auth.users;
create trigger teamhub_on_auth_user_created after insert on auth.users
  for each row execute function teamhub_handle_new_user();

-- Deleting an auth user: pending people disappear; everyone else is anonymized so history stays attributed.
create or replace function teamhub_handle_deleted_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from profiles where id = old.id and status = 'pending') then
    delete from profiles where id = old.id;
  else
    update profiles set display_name = 'Former member', avatar_path = null, details = '{}', home_prefs = null,
      status = 'inactive', is_admin = false where id = old.id;
    delete from profiles_private where user_id = old.id;
    update memberships set status = 'inactive', note = null where user_id = old.id;
    delete from position_holders where user_id = old.id;
  end if;
  return old;
end $$;
drop trigger if exists teamhub_on_auth_user_deleted on auth.users;
create trigger teamhub_on_auth_user_deleted after delete on auth.users
  for each row execute function teamhub_handle_deleted_user();

-- Notify approvers about a new pending membership.
create or replace function teamhub_membership_requested() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending' then
    perform teamhub_notify(
      array(select teamhub_users_with(
        case when new.requested_type in ('captain', 'mentor') then 'people.approve_leaders' else 'people.approve_members' end,
        new.team_id)),
      'people.request', 'core:person:' || new.user_id);
  end if;
  return new;
end $$;
drop trigger if exists memberships_requested on memberships;
create trigger memberships_requested after insert on memberships
  for each row execute function teamhub_membership_requested();

-- ── People RPCs ─────────────────────────────────────────────────────────────
create or replace function people_can_approve(p_team uuid, p_type text) returns boolean
language sql stable security definer set search_path = public as $$
  select case when p_type = 'member' then teamhub_can('people.approve_members', p_team)
              else teamhub_can('people.approve_leaders', p_team) end
$$;

create or replace function people_approve(
  p_user uuid, p_team uuid, p_type text, p_positions text[] default '{}', p_details jsonb default null
) returns void
language plpgsql security definer set search_path = public as $$
declare m memberships;
begin
  select * into m from memberships where user_id = p_user and team_id = p_team;
  if not found then raise exception 'No request found'; end if;
  if p_type not in ('member', 'captain', 'mentor') then raise exception 'Invalid type'; end if;
  -- Tiered rule: the stricter of requested and granted type decides who may approve.
  if not people_can_approve(p_team, p_type) or not people_can_approve(p_team, coalesce(m.requested_type, 'member')) then
    raise exception 'Only mentors or admins can approve Captains and Mentors' using errcode = '42501';
  end if;
  update memberships set status = 'active', type = p_type, approved_by = auth.uid() where user_id = p_user and team_id = p_team;
  update profiles set status = 'active', details = case when p_details is null then details else details || p_details end
    where id = p_user;
  if coalesce(array_length(p_positions, 1), 0) > 0 then
    perform people_assign_positions(p_user, p_positions);
  end if;
  perform teamhub_notify(array[p_user], 'people.approved', 'core:team:' || p_team);
end $$;

create or replace function people_reject(p_user uuid, p_team uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare m memberships;
begin
  select * into m from memberships where user_id = p_user and team_id = p_team and status = 'pending';
  if not found then raise exception 'No pending request'; end if;
  if not people_can_approve(p_team, coalesce(m.requested_type, 'member')) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  delete from memberships where user_id = p_user and team_id = p_team;
  -- true → the client should delete the auth user (edge function admin-delete-user)
  return not exists (select 1 from memberships where user_id = p_user)
     and exists (select 1 from profiles where id = p_user and status = 'pending');
end $$;

create or replace function people_assign_positions(p_user uuid, p_positions text[]) returns void
language plpgsql security definer set search_path = public as $$
declare p positions;
begin
  for p in select * from positions where id = any (p_positions) loop
    if not (teamhub_can('people.assign_positions', p.team_id)
            or (not p.grants_permissions and teamhub_can('people.assign_badges', p.team_id))) then
      raise exception 'Not allowed to assign %', p.name using errcode = '42501';
    end if;
    insert into position_holders (position_id, user_id, team_id) values (p.id, p_user, p.team_id) on conflict do nothing;
  end loop;
end $$;

create or replace function people_set_admin(p_user uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not teamhub_is_admin() then raise exception 'Only admins can change admins' using errcode = '42501'; end if;
  update profiles set is_admin = p_on where id = p_user and status = 'active';
end $$;

-- p_team null → deactivate everywhere.
create or replace function people_set_active(p_user uuid, p_team uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_team is null then
    if not (teamhub_is_admin() or teamhub_can('people.deactivate', null)) then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    update memberships set status = case when p_active then 'active' else 'inactive' end
      where user_id = p_user and status <> 'pending';
    update profiles set status = case when p_active then 'active' else 'inactive' end where id = p_user and status <> 'pending';
  else
    if not teamhub_can('people.deactivate', p_team) then raise exception 'Not allowed' using errcode = '42501'; end if;
    update memberships set status = case when p_active then 'active' else 'inactive' end
      where user_id = p_user and team_id = p_team and status <> 'pending';
  end if;
end $$;

create or replace function people_set_type(p_user uuid, p_team uuid, p_type text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not people_can_approve(p_team, p_type) then raise exception 'Not allowed' using errcode = '42501'; end if;
  update memberships set type = p_type where user_id = p_user and team_id = p_team;
end $$;

-- Used by edge functions with the caller's JWT before acting with the service role.
create or replace function people_can_delete_user(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_user <> auth.uid() and (
    teamhub_is_admin()
    or (exists (select 1 from profiles where id = p_user and status = 'pending')
        and not exists (select 1 from memberships where user_id = p_user))
    or (not exists (select 1 from profiles where id = p_user and is_admin)
        and exists (select 1 from memberships m where m.user_id = p_user and teamhub_can('people.deactivate', m.team_id)))
  )
$$;

create or replace function people_can_reset_password(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select teamhub_is_admin() or (
    not exists (select 1 from profiles where id = p_user and is_admin)
    and exists (select 1 from memberships m where m.user_id = p_user and teamhub_can('people.reset_password', m.team_id))
  )
$$;

-- Who still hasn't filled the requested fields (no values leak; spec §12.2).
create or replace function info_request_status(p_request uuid)
returns table (user_id uuid, missing text[])
language plpgsql stable security definer set search_path = public as $$
declare r info_requests;
begin
  select * into r from info_requests where id = p_request;
  if not found then return; end if;
  if not (r.created_by = auth.uid() or teamhub_can('people.request_info', r.team_id)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
    select p.id, array(
      select f from unnest(r.fields) f
      where coalesce(nullif(p.details->>f, ''), nullif(pp.data->>f, '')) is null)
    from profiles p
    left join profiles_private pp on pp.user_id = p.id
    where p.status = 'active'
      and (r.team_id is null or exists (select 1 from memberships m where m.user_id = p.id and m.team_id = r.team_id and m.status = 'active'));
end $$;

-- ── Ops RPCs ────────────────────────────────────────────────────────────────
create or replace function teamhub_ping() returns timestamptz
language sql security definer set search_path = public as $$
  update teamhub_settings set last_keepalive = now() where id = 1 returning last_keepalive
$$;

create or replace function teamhub_storage_usage() returns jsonb
language plpgsql stable security definer set search_path = public, storage as $$
begin
  if not teamhub_is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  return jsonb_build_object(
    'db_bytes', pg_database_size(current_database()),
    'tables', coalesce((
      select jsonb_object_agg(c.relname, pg_total_relation_size(c.oid))
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'), '{}'),
    'buckets', coalesce((
      select jsonb_agg(jsonb_build_object('bucket', bucket_id, 'bytes', bytes, 'count', n))
      from (select bucket_id, sum(coalesce((metadata->>'size')::bigint, 0)) bytes, count(*) n
            from storage.objects group by bucket_id) b), '[]'),
    'top_files', coalesce((
      select jsonb_agg(jsonb_build_object('bucket', bucket_id, 'name', name, 'bytes', size, 'created_at', created_at))
      from (select bucket_id, name, coalesce((metadata->>'size')::bigint, 0) size, created_at
            from storage.objects order by 3 desc limit 10) t), '[]'),
    'limits', (select storage_limits from teamhub_settings where id = 1)
  );
end $$;

-- Admin file browser for bulk cleanup (Admin → Storage, spec §12.3).
create or replace function teamhub_list_files(p_bucket text, p_before timestamptz default now())
returns table (name text, bytes bigint, created_at timestamptz)
language plpgsql stable security definer set search_path = public, storage as $$
begin
  if not teamhub_is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  return query select o.name, coalesce((o.metadata->>'size')::bigint, 0), o.created_at
    from storage.objects o where o.bucket_id = p_bucket and o.created_at < p_before
    order by o.created_at limit 2000;
end $$;

-- "Delete my account" request: notifies admins (deletion itself is done by a mentor/admin, spec §15).
create or replace function people_request_deletion() returns void
language sql security definer set search_path = public as $$
  select teamhub_notify(array(select teamhub_users_with('people.deactivate', null)), 'people.deletion_request', 'core:person:' || auth.uid())
$$;

-- Any active member may ask "is file storage nearly full?" (FileDrop refuses uploads at ≥ 98 %, spec §11.4).
create or replace function teamhub_files_nearly_full() returns boolean
language sql stable security definer set search_path = public, storage as $$
  select teamhub_is_active() and coalesce((select sum(coalesce((metadata->>'size')::bigint, 0)) from storage.objects), 0)
    >= 0.98 * 1024 * 1024 * coalesce((select (storage_limits->>'files_mb')::numeric from teamhub_settings where id = 1), 1024)
$$;

-- Lock down internal functions.
revoke execute on function teamhub_drop_policies(text), teamhub_make_dormant(text), teamhub_drop_prefix(text),
  teamhub_trash(text, text[]), teamhub_notify(uuid[], text, text), teamhub_realtime_add(text)
  from public, anon, authenticated;
