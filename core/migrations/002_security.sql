-- Security hardening (v1 review). Function replacements only — expand-only rule holds.

-- Rank of a profile type, for "you can only manage people below you" checks.
create or replace function people_rank(p_type text) returns int
language sql immutable as $$
  select case p_type when 'mentor' then 3 when 'captain' then 2 when 'member' then 1 else 0 end
$$;

-- Caller outranks the target within p_team (or, with p_team null, in every team the target belongs to).
-- Admins outrank everyone (the last-admin trigger still applies).
-- Mentors can manage captains and members, but no non-admin can manage a mentor or an admin.
create or replace function people_outranks(p_user uuid, p_team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_user <> auth.uid() and (
    teamhub_is_admin()
    or (
      not exists (select 1 from profiles where id = p_user and is_admin)
      and coalesce((select max(people_rank(m.type)) from memberships m where m.user_id = p_user and m.status <> 'pending'), 0)
        < coalesce((select max(people_rank(m.type)) from memberships m
                    where m.user_id = auth.uid() and m.status = 'active'
                      and (p_team is null or m.team_id = p_team)), 0)
    )
  )
$$;

-- Approval only works on a pending request (it can't be used to change an active member's type or revive someone).
create or replace function people_approve(
  p_user uuid, p_team uuid, p_type text, p_positions text[] default '{}', p_details jsonb default null
) returns void
language plpgsql security definer set search_path = public as $$
declare m memberships;
begin
  select * into m from memberships where user_id = p_user and team_id = p_team and status = 'pending';
  if not found then raise exception 'No pending request found'; end if;
  if p_type not in ('member', 'captain', 'mentor') then raise exception 'Invalid type'; end if;
  if not people_can_approve(p_team, p_type) or not people_can_approve(p_team, coalesce(m.requested_type, 'member')) then
    raise exception 'Only mentors or admins can approve Captains and Mentors' using errcode = '42501';
  end if;
  update memberships set status = 'active', type = p_type, approved_by = auth.uid() where user_id = p_user and team_id = p_team;
  update profiles set status = 'active', details = case when p_details is null then details else details || p_details end
    where id = p_user and status = 'pending';
  if coalesce(array_length(p_positions, 1), 0) > 0 then
    perform people_assign_positions(p_user, p_positions);
  end if;
  perform teamhub_notify(array[p_user], 'people.approved', 'core:team:' || p_team);
end $$;

-- Changing someone's type needs approval rights for both the old and new type, and you must outrank them.
create or replace function people_set_type(p_user uuid, p_team uuid, p_type text) returns void
language plpgsql security definer set search_path = public as $$
declare cur text;
begin
  select type into cur from memberships where user_id = p_user and team_id = p_team and status <> 'pending';
  if not found then raise exception 'No membership found'; end if;
  if not (people_can_approve(p_team, p_type) and people_can_approve(p_team, cur) and people_outranks(p_user, p_team)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update memberships set type = p_type where user_id = p_user and team_id = p_team;
end $$;

-- Deactivate in one team (needs people.deactivate there) or everywhere (admins, or someone allowed in every team
-- the person belongs to). Nobody but an admin can deactivate a mentor or an admin.
create or replace function people_set_active(p_user uuid, p_team uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_team is null then
    if not (teamhub_is_admin() or (
      people_outranks(p_user, null)
      and not exists (select 1 from memberships m where m.user_id = p_user and not teamhub_can('people.deactivate', m.team_id)))) then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    update memberships set status = case when p_active then 'active' else 'inactive' end
      where user_id = p_user and status <> 'pending';
    update profiles set status = case when p_active then 'active' else 'inactive' end where id = p_user and status <> 'pending';
  else
    if not (teamhub_can('people.deactivate', p_team) and people_outranks(p_user, p_team)) then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    update memberships set status = case when p_active then 'active' else 'inactive' end
      where user_id = p_user and team_id = p_team and status <> 'pending';
  end if;
end $$;

-- Positions can only be given to people on that position's team (or anyone, for program-wide positions).
create or replace function people_assign_positions(p_user uuid, p_positions text[]) returns void
language plpgsql security definer set search_path = public as $$
declare p positions;
begin
  for p in select * from positions where id = any (p_positions) loop
    if not (teamhub_can('people.assign_positions', p.team_id)
            or (not p.grants_permissions and teamhub_can('people.assign_badges', p.team_id))) then
      raise exception 'Not allowed to assign %', p.name using errcode = '42501';
    end if;
    if p.team_id is not null and not exists (select 1 from memberships where user_id = p_user and team_id = p.team_id) then
      raise exception '% is a position on another team', p.name using errcode = '42501';
    end if;
    insert into position_holders (position_id, user_id, team_id) values (p.id, p_user, p.team_id) on conflict do nothing;
  end loop;
end $$;

-- Deleting a login (edge function admin-delete-user): pending sign-ups by their approvers; everyone else only by
-- someone who can deactivate them in every team they belong to and outranks them.
create or replace function people_can_delete_user(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_user <> auth.uid() and (
    teamhub_is_admin()
    or (exists (select 1 from profiles where id = p_user and status = 'pending')
        and exists (select 1 from memberships m where m.user_id = p_user)
        and not exists (select 1 from memberships m where m.user_id = p_user
                        and not people_can_approve(m.team_id, coalesce(m.requested_type, 'member'))))
    or (people_outranks(p_user, null)
        and exists (select 1 from memberships m where m.user_id = p_user)
        and not exists (select 1 from memberships m where m.user_id = p_user and not teamhub_can('people.deactivate', m.team_id)))
  )
$$;

-- Reset links let the holder sign in as that person, so the caller must outrank them (no peer/upward takeovers).
create or replace function people_can_reset_password(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (teamhub_is_admin() and p_user <> auth.uid())
    or exists (select 1 from memberships m where m.user_id = p_user and m.status = 'active'
               and teamhub_can('people.reset_password', m.team_id) and people_outranks(p_user, m.team_id))
$$;
