alter table evt_notes enable row level security;
create policy evt_notes_read on evt_notes for select to authenticated using (teamhub_in_team(team_id));
create policy evt_notes_write on evt_notes for all to authenticated
  using (teamhub_can('events.notes', team_id)) with check (teamhub_can('events.notes', team_id));
