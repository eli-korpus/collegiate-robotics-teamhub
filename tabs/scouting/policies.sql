-- Scouting data is internal to the program (never public).
alter table sct_templates enable row level security;
alter table sct_entries enable row level security;
alter table sct_picklist enable row level security;

create policy sct_templates_read on sct_templates for select to authenticated using (teamhub_is_active());
create policy sct_templates_write on sct_templates for all to authenticated
  using (teamhub_can('scouting.manage_template', null)) with check (teamhub_can('scouting.manage_template', null));

create policy sct_entries_read on sct_entries for select to authenticated using (teamhub_is_active());
create policy sct_entries_insert on sct_entries for insert to authenticated
  with check (teamhub_can('scouting.scout', null) and scout = (select auth.uid()));
create policy sct_entries_update on sct_entries for update to authenticated
  using (scout = (select auth.uid()) or teamhub_can('scouting.delete_entries', null))
  with check (scout = (select auth.uid()) or teamhub_can('scouting.delete_entries', null));
create policy sct_entries_delete on sct_entries for delete to authenticated
  using (scout = (select auth.uid()) or teamhub_can('scouting.delete_entries', null));

create policy sct_picklist_read on sct_picklist for select to authenticated using (teamhub_in_team(team_id));
create policy sct_picklist_insert on sct_picklist for insert to authenticated with check (teamhub_can('scouting.manage_picklist', team_id));
create policy sct_picklist_update on sct_picklist for update to authenticated
  using (teamhub_can('scouting.manage_picklist', team_id)) with check (teamhub_can('scouting.manage_picklist', team_id));
create policy sct_picklist_delete on sct_picklist for delete to authenticated using (teamhub_is_admin());

alter table sct_events enable row level security;
create policy sct_events_read on sct_events for select to authenticated using (teamhub_is_active());
create policy sct_events_insert on sct_events for insert to authenticated with check (teamhub_can('scouting.scout', null));
create policy sct_events_update on sct_events for update to authenticated
  using (teamhub_can('scouting.scout', null)) with check (teamhub_can('scouting.scout', null));
-- Past event data is kept; only admins delete it.
create policy sct_events_delete on sct_events for delete to authenticated using (teamhub_is_admin());
