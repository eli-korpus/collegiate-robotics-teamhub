alter table code_opmodes enable row level security;
create policy code_opmodes_read on code_opmodes for select to authenticated using (teamhub_in_team(team_id) and teamhub_can('code-hub.view', team_id));
create policy code_opmodes_write on code_opmodes for all to authenticated
  using (teamhub_can('code-hub.edit', team_id)) with check (teamhub_can('code-hub.edit', team_id));
