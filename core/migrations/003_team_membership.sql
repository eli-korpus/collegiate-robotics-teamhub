-- Managing which teams someone is on, from their profile (multi-team programs). Function additions only.

-- Add an active person to a team (or change nothing but their role if they're already on it, or revive an inactive
-- membership, or approve a pending request for that team). Same rules as approving: captains add members, mentors add
-- anyone, admins anything; and you can't add someone who outranks you.
create or replace function people_add_to_team(p_user uuid, p_team uuid, p_type text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_type not in ('member', 'captain', 'mentor') then raise exception 'Invalid type'; end if;
  if not exists (select 1 from teams where id = p_team and not archived) then raise exception 'Unknown team'; end if;
  if not exists (select 1 from profiles where id = p_user and status = 'active') then
    raise exception 'Only active people can be added to a team — approve their sign-up first' using errcode = 'P0001';
  end if;
  if not (teamhub_is_admin() or (people_can_approve(p_team, p_type) and people_outranks(p_user, p_team))) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into memberships (user_id, team_id, type, status, approved_by)
  values (p_user, p_team, p_type, 'active', auth.uid())
  on conflict (user_id, team_id) do update set type = excluded.type, status = 'active', approved_by = excluded.approved_by;
  perform teamhub_notify(array[p_user], 'people.approved', 'core:team:' || p_team);
end $$;

-- Take someone off one team. Their history stays attributed to them; team-specific positions on that team are removed.
-- To remove someone from their last team, deactivate them instead (so they can't end up active with no team).
create or replace function people_remove_from_team(p_user uuid, p_team uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from memberships where user_id = p_user and team_id = p_team) then raise exception 'Not on that team'; end if;
  if not (teamhub_is_admin() or (teamhub_can('people.deactivate', p_team) and people_outranks(p_user, p_team))) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from memberships where user_id = p_user and team_id <> p_team and status = 'active') then
    raise exception 'This is their only team — deactivate them instead' using errcode = 'P0001';
  end if;
  delete from memberships where user_id = p_user and team_id = p_team;
  delete from position_holders where user_id = p_user and team_id = p_team;
end $$;
