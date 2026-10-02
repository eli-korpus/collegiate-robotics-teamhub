alter table jdg_questions enable row level security;
alter table jdg_criteria enable row level security;
create policy jdg_questions_read on jdg_questions for select to authenticated using (teamhub_in_team(team_id) and teamhub_can('judging.view', team_id));
create policy jdg_questions_write on jdg_questions for all to authenticated using (teamhub_can('judging.manage', team_id)) with check (teamhub_can('judging.manage', team_id));
create policy jdg_criteria_read on jdg_criteria for select to authenticated using (teamhub_in_team(team_id) and teamhub_can('judging.view', team_id));
create policy jdg_criteria_write on jdg_criteria for all to authenticated using (teamhub_can('judging.manage', team_id)) with check (teamhub_can('judging.manage', team_id));
