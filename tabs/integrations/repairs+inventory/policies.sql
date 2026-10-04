alter table ix_repinv_parts enable row level security;
create policy ix_repinv_parts_read on ix_repinv_parts for select to authenticated
  using (exists (select 1 from rep_issues i where i.id = issue_id and teamhub_in_team(i.team_id)));
