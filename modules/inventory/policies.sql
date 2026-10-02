alter table inv_items enable row level security;
create policy inv_items_read on inv_items for select to authenticated using (teamhub_in_team(team_id));
create policy inv_items_write on inv_items for all to authenticated
  using (teamhub_can('inventory.manage', team_id)) with check (teamhub_can('inventory.manage', team_id));
