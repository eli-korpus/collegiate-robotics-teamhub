alter table mer_drives enable row level security;
alter table mer_orders enable row level security;
create policy mer_drives_read on mer_drives for select to authenticated using (teamhub_in_team(team_id));
create policy mer_drives_write on mer_drives for all to authenticated using (teamhub_can('merch.manage', team_id)) with check (teamhub_can('merch.manage', team_id));
-- Members see only their own order; managers see all (spec §13.28).
create policy mer_orders_read on mer_orders for select to authenticated using (
  user_id = (select auth.uid())
  or exists (select 1 from mer_drives d where d.id = drive_id and (teamhub_can('merch.manage', d.team_id) or teamhub_can('merch.mark_paid', d.team_id))));
create policy mer_orders_insert on mer_orders for insert to authenticated with check (
  exists (select 1 from mer_drives d where d.id = drive_id and (
    (user_id = (select auth.uid()) and teamhub_can('merch.order', d.team_id)) or teamhub_can('merch.manage', d.team_id))));
create policy mer_orders_update on mer_orders for update to authenticated
  using (user_id = (select auth.uid()) or exists (select 1 from mer_drives d where d.id = drive_id and (teamhub_can('merch.manage', d.team_id) or teamhub_can('merch.mark_paid', d.team_id))))
  with check (user_id = (select auth.uid()) or exists (select 1 from mer_drives d where d.id = drive_id and (teamhub_can('merch.manage', d.team_id) or teamhub_can('merch.mark_paid', d.team_id))));
create policy mer_orders_delete on mer_orders for delete to authenticated using (
  exists (select 1 from mer_drives d where d.id = drive_id and (
    teamhub_can('merch.manage', d.team_id) or (user_id = (select auth.uid()) and d.status = 'open' and not paid))));
