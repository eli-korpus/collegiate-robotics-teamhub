-- Positions can be "whole program" (one holder covers every team) or "each team has its own" (per_team: every team
-- can have its own holder, and the holder only acts for that team). Additions only; the per-team holder's team is
-- stored in position_holders.team_id, which teamhub_has_position already checks.

alter table positions add column if not exists per_team boolean not null default false;

-- Assign positions to someone, for a team. Per-team positions need the team (the person must be on it); other
-- positions ignore it. Same permission rules as before, checked for that team.
create or replace function people_assign_positions_in_team(p_user uuid, p_positions text[], p_team uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  p positions;
  t uuid;
  cur uuid;
begin
  for p in select * from positions where id = any (p_positions) loop
    t := case when p.per_team then p_team else p.team_id end;
    if p.per_team and t is null then
      raise exception 'Pick which team % is for', p.name using errcode = 'P0001';
    end if;
    if not (teamhub_can('people.assign_positions', t)
            or (not p.grants_permissions and teamhub_can('people.assign_badges', t))) then
      raise exception 'Not allowed to assign %', p.name using errcode = '42501';
    end if;
    if t is not null and not exists (select 1 from memberships where user_id = p_user and team_id = t) then
      raise exception '% is a position on another team', p.name using errcode = '42501';
    end if;
    select team_id into cur from position_holders where position_id = p.id and user_id = p_user;
    if found and p.per_team and cur is distinct from t then
      raise exception 'They already hold % for another team. Remove that first', p.name using errcode = 'P0001';
    end if;
    insert into position_holders (position_id, user_id, team_id) values (p.id, p_user, t) on conflict do nothing;
  end loop;
end $$;

-- Without a team: per-team positions go to the person's team when they're on exactly one.
create or replace function people_assign_positions(p_user uuid, p_positions text[]) returns void
language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  if (select count(*) from memberships where user_id = p_user and status <> 'pending') = 1 then
    select team_id into t from memberships where user_id = p_user and status <> 'pending';
  end if;
  perform people_assign_positions_in_team(p_user, p_positions, t);
end $$;

-- Same as before (002_security), but positions given while approving are for the team being approved into.
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
    perform people_assign_positions_in_team(p_user, p_positions, p_team);
  end if;
  perform teamhub_notify(array[p_user], 'people.approved', 'core:team:' || p_team);
end $$;
