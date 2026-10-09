alter table mfg_jobs enable row level security;
alter table mfg_files enable row level security;

create policy mfg_jobs_read on mfg_jobs for select to authenticated using (teamhub_in_team(team_id));
create policy mfg_jobs_insert on mfg_jobs for insert to authenticated
  with check (teamhub_can('manufacture.submit', team_id) and requested_by = (select auth.uid()) and status = 'submitted');
create policy mfg_jobs_update on mfg_jobs for update to authenticated
  using (mfg_can_manage(method, team_id) or (requested_by = (select auth.uid()) and status = 'submitted'))
  with check (teamhub_can('manufacture.submit', team_id) or mfg_can_manage(method, team_id));
create policy mfg_jobs_delete on mfg_jobs for delete to authenticated
  using (mfg_can_manage(method, team_id) or (requested_by = (select auth.uid()) and status = 'submitted'));

create policy mfg_files_read on mfg_files for select to authenticated
  using (exists (select 1 from mfg_jobs j where j.id = job_id and teamhub_in_team(j.team_id)));
create policy mfg_files_insert on mfg_files for insert to authenticated
  with check (exists (select 1 from mfg_jobs j where j.id = job_id and (mfg_can_manage(j.method, j.team_id) or (j.requested_by = (select auth.uid()) and j.status = 'submitted'))));
create policy mfg_files_delete on mfg_files for delete to authenticated
  using (exists (select 1 from mfg_jobs j where j.id = job_id and (mfg_can_manage(j.method, j.team_id) or (j.requested_by = (select auth.uid()) and j.status = 'submitted'))));
