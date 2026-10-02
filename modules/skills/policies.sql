alter table skill_skills enable row level security;
alter table skill_signoffs enable row level security;
create policy skill_skills_read on skill_skills for select to authenticated using (teamhub_in_team(team_id));
create policy skill_skills_write on skill_skills for all to authenticated using (teamhub_can('skills.manage', team_id)) with check (teamhub_can('skills.manage', team_id));
create policy skill_signoffs_read on skill_signoffs for select to authenticated using (exists (select 1 from skill_skills s where s.id = skill_id and teamhub_in_team(s.team_id)));
-- Nobody signs themselves off (admins excepted, for setup).
create policy skill_signoffs_insert on skill_signoffs for insert to authenticated with check (
  signed_by = (select auth.uid()) and (user_id <> (select auth.uid()) or teamhub_is_admin())
  and exists (select 1 from skill_skills s where s.id = skill_id and teamhub_can('skills.sign_off', s.team_id)));
create policy skill_signoffs_delete on skill_signoffs for delete to authenticated using (
  exists (select 1 from skill_skills s where s.id = skill_id and teamhub_can('skills.sign_off', s.team_id)));
