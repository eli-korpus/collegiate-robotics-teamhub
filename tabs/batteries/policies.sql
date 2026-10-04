alter table bat_batteries enable row level security;
alter table bat_logs enable row level security;

create policy bat_batteries_read on bat_batteries for select to authenticated using (teamhub_in_team(team_id));
create policy bat_batteries_write on bat_batteries for all to authenticated
  using (teamhub_can('batteries.manage', team_id)) with check (teamhub_can('batteries.manage', team_id));

create policy bat_logs_read on bat_logs for select to authenticated
  using (exists (select 1 from bat_batteries b where b.id = battery_id and teamhub_in_team(b.team_id)));
create policy bat_logs_insert on bat_logs for insert to authenticated
  with check (by = (select auth.uid()) and exists (select 1 from bat_batteries b where b.id = battery_id and teamhub_can('batteries.log', b.team_id)));
create policy bat_logs_delete on bat_logs for delete to authenticated
  using (by = (select auth.uid()) or exists (select 1 from bat_batteries b where b.id = battery_id and teamhub_can('batteries.manage', b.team_id)));
