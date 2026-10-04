alter table nb_subsystems enable row level security;
alter table nb_entries enable row level security;
alter table nb_images enable row level security;

create policy nb_subsystems_read on nb_subsystems for select to authenticated using (teamhub_in_team(team_id));
create policy nb_subsystems_write on nb_subsystems for all to authenticated
  using (teamhub_can('notebook.manage_subsystems', team_id)) with check (teamhub_can('notebook.manage_subsystems', team_id));

create policy nb_entries_read on nb_entries for select to authenticated using (teamhub_in_team(team_id));
create policy nb_entries_insert on nb_entries for insert to authenticated
  with check (teamhub_can('notebook.write', team_id) and created_by = (select auth.uid()));
create policy nb_entries_update on nb_entries for update to authenticated using (nb_can_edit(nb_entries)) with check (teamhub_can('notebook.write', team_id) or teamhub_can('notebook.edit_any', team_id));
create policy nb_entries_delete on nb_entries for delete to authenticated
  using (teamhub_can('notebook.delete_any', team_id) or (created_by = (select auth.uid()) and teamhub_can('notebook.write', team_id)));

create policy nb_images_read on nb_images for select to authenticated
  using (exists (select 1 from nb_entries e where e.id = entry_id and teamhub_in_team(e.team_id)));
create policy nb_images_write on nb_images for all to authenticated
  using (exists (select 1 from nb_entries e where e.id = entry_id and (nb_can_edit(e) or teamhub_can('notebook.delete_any', e.team_id))))
  with check (exists (select 1 from nb_entries e where e.id = entry_id and nb_can_edit(e)));
