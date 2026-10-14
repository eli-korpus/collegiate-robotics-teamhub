-- Leave a team yourself, or take back a request to join one (multi-team programs). Function additions only.
-- Removing someone else needs people.deactivate and a higher rank, which nobody has over themselves, so leaving gets its
-- own function. You can't leave your last active team: that would leave you active with no team.
create or replace function people_leave_team(p_team uuid) returns void
language plpgsql security definer set search_path = public as $$
declare st text;
begin
  select status into st from memberships where user_id = auth.uid() and team_id = p_team;
  if st is null then raise exception 'You are not on that team' using errcode = 'P0001'; end if;
  if st = 'active' and not exists (select 1 from memberships where user_id = auth.uid() and team_id <> p_team and status = 'active') then
    raise exception 'This is your only team. To leave the program, ask for your account to be deleted' using errcode = 'P0001';
  end if;
  delete from memberships where user_id = auth.uid() and team_id = p_team;
  delete from position_holders where user_id = auth.uid() and team_id = p_team;
end $$;
revoke execute on function people_leave_team(uuid) from public, anon;
