alter table chk_lists enable row level security;
alter table chk_runs enable row level security;

create policy chk_lists_read on chk_lists for select to authenticated using (teamhub_in_team(team_id));
create policy chk_lists_write on chk_lists for all to authenticated
  using (teamhub_can('checklists.manage_lists', team_id)) with check (teamhub_can('checklists.manage_lists', team_id));

create policy chk_runs_read on chk_runs for select to authenticated
  using (exists (select 1 from chk_lists l where l.id = list_id and teamhub_in_team(l.team_id)));
create policy chk_runs_insert on chk_runs for insert to authenticated
  with check (started_by = (select auth.uid()) and exists (select 1 from chk_lists l where l.id = list_id and teamhub_can('checklists.run', l.team_id)));
create policy chk_runs_update on chk_runs for update to authenticated
  using (exists (select 1 from chk_lists l where l.id = list_id and teamhub_can('checklists.run', l.team_id)));
create policy chk_runs_delete on chk_runs for delete to authenticated
  using (exists (select 1 from chk_lists l where l.id = list_id and teamhub_can('checklists.manage_lists', l.team_id)));
