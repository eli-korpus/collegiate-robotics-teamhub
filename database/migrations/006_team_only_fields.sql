-- Three levels for profile fields: everyone (profiles.details), team leaders (profiles_leaders: the person, captains
-- and mentors on their team, admins; e.g. shirt sizes) and mentors (profiles_private: the person, mentors, admins;
-- e.g. emergency contacts). This adds the middle level. Additions only.

create table if not exists profiles_leaders (
  user_id uuid primary key references profiles (id) on delete cascade,
  data jsonb not null default '{}'
);

-- Same as before (001_core), plus clearing team-only fields when someone's account is deleted.
create or replace function teamhub_handle_deleted_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from profiles where id = old.id and status = 'pending') then
    delete from profiles where id = old.id;
  else
    update profiles set display_name = 'Former member', avatar_path = null, details = '{}', home_prefs = null,
      status = 'inactive', is_admin = false where id = old.id;
    delete from profiles_private where user_id = old.id;
    delete from profiles_leaders where user_id = old.id;
    update memberships set status = 'inactive', note = null where user_id = old.id;
    delete from position_holders where user_id = old.id;
  end if;
  return old;
end $$;

-- Same as before (001_core), but a field counts as answered wherever it's stored.
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
      where coalesce(nullif(p.details->>f, ''), nullif(pl.data->>f, ''), nullif(pp.data->>f, '')) is null)
    from profiles p
    left join profiles_private pp on pp.user_id = p.id
    left join profiles_leaders pl on pl.user_id = p.id
    where p.status = 'active'
      and (r.team_id is null or exists (select 1 from memberships m where m.user_id = p.id and m.team_id = r.team_id and m.status = 'active'));
end $$;

-- Keeps each profile field's answers where its visibility level says (run by every database update, so changing a
-- field from "everyone" to "team leaders" moves the answers out of the public profile). An answer already in the
-- right place wins.
create or replace function teamhub_place_profile_field(p_field text, p_level text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_level not in ('everyone', 'leaders', 'mentors') then raise exception 'Unknown level %', p_level; end if;
  create temporary table if not exists teamhub_moving (user_id uuid primary key, v jsonb) on commit drop;
  truncate teamhub_moving;
  insert into teamhub_moving
    select distinct on (user_id) user_id, v from (
      select id as user_id, details -> p_field as v, 1 as o from profiles where p_level <> 'everyone' and details ? p_field
      union all select user_id, data -> p_field, 2 from profiles_leaders where p_level <> 'leaders' and data ? p_field
      union all select user_id, data -> p_field, 3 from profiles_private where p_level <> 'mentors' and data ? p_field
    ) s where v is not null and v <> '""'::jsonb order by user_id, o;
  if p_level = 'everyone' then
    update profiles p set details = jsonb_build_object(p_field, m.v) || coalesce(p.details, '{}') from teamhub_moving m where m.user_id = p.id;
  elsif p_level = 'leaders' then
    insert into profiles_leaders (user_id, data) select user_id, jsonb_build_object(p_field, v) from teamhub_moving
      on conflict (user_id) do update set data = excluded.data || profiles_leaders.data;
  else
    insert into profiles_private (user_id, data) select user_id, jsonb_build_object(p_field, v) from teamhub_moving
      on conflict (user_id) do update set data = excluded.data || profiles_private.data;
  end if;
  if p_level <> 'everyone' then update profiles set details = details - p_field where details ? p_field; end if;
  if p_level <> 'leaders' then update profiles_leaders set data = data - p_field where data ? p_field; end if;
  if p_level <> 'mentors' then update profiles_private set data = data - p_field where data ? p_field; end if;
end $$;
revoke execute on function teamhub_place_profile_field(text, text) from public, anon, authenticated;
