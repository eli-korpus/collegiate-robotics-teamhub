alter table rep_issues enable row level security;
create policy rep_issues_read on rep_issues for select to authenticated using (teamhub_in_team(team_id));
create policy rep_issues_insert on rep_issues for insert to authenticated
  with check (teamhub_can('repairs.report', team_id) and reported_by = (select auth.uid()));
create policy rep_issues_update on rep_issues for update to authenticated
  using (teamhub_can('repairs.manage', team_id) or (reported_by = (select auth.uid()) and teamhub_can('repairs.report', team_id)))
  with check (teamhub_in_team(team_id));
create policy rep_issues_delete on rep_issues for delete to authenticated
  using (teamhub_can('repairs.manage', team_id) or (reported_by = (select auth.uid()) and status = 'open'));
