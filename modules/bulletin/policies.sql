-- Bulletin Board lets more people add links to the core links table (spec §13.3). Pinned tool links (slot) stay
-- editable only with core.edit_links.
create policy bul_links_insert on links for insert to authenticated
  with check (teamhub_can('bulletin.post', team_id) and created_by = (select auth.uid()) and slot is null);
create policy bul_links_update on links for update to authenticated
  using (((created_by = (select auth.uid()) and teamhub_can('bulletin.post', team_id)) or teamhub_can('bulletin.manage', team_id)) and slot is null)
  with check (slot is null);
create policy bul_links_delete on links for delete to authenticated
  using (((created_by = (select auth.uid()) and teamhub_can('bulletin.post', team_id)) or teamhub_can('bulletin.manage', team_id)) and slot is null);
