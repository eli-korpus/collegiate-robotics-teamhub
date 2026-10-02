alter table drv_fields enable row level security;
alter table drv_runs enable row level security;
create policy drv_fields_read on drv_fields for select to authenticated using (teamhub_is_active());
create policy drv_fields_write on drv_fields for update to authenticated
  using (teamhub_can('driver-practice.manage_fields', null)) with check (teamhub_can('driver-practice.manage_fields', null));
create policy drv_runs_read on drv_runs for select to authenticated using (teamhub_in_team(team_id));
create policy drv_runs_insert on drv_runs for insert to authenticated
  with check (teamhub_can('driver-practice.log', team_id) and created_by = (select auth.uid()));
create policy drv_runs_change on drv_runs for update to authenticated
  using (created_by = (select auth.uid()) or teamhub_can('driver-practice.manage_fields', team_id)) with check (teamhub_in_team(team_id));
create policy drv_runs_delete on drv_runs for delete to authenticated
  using (created_by = (select auth.uid()) or teamhub_can('driver-practice.manage_fields', team_id));
