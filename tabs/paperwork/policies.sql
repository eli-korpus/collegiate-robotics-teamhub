alter table ppr_items enable row level security;
alter table ppr_done enable row level security;
create policy ppr_items_read on ppr_items for select to authenticated using (teamhub_in_team(team_id));
create policy ppr_items_write on ppr_items for all to authenticated using (teamhub_can('paperwork.manage', team_id)) with check (teamhub_can('paperwork.manage', team_id));
-- Members see only their own status (spec §13.6).
create policy ppr_done_read on ppr_done for select to authenticated using (
  user_id = (select auth.uid())
  or exists (select 1 from ppr_items i where i.id = item_id and (teamhub_can('paperwork.view_all', i.team_id) or teamhub_can('paperwork.mark', i.team_id)))
);
create policy ppr_done_write on ppr_done for all to authenticated
  using (exists (select 1 from ppr_items i where i.id = item_id and teamhub_can('paperwork.mark', i.team_id)))
  with check (exists (select 1 from ppr_items i where i.id = item_id and teamhub_can('paperwork.mark', i.team_id)));
