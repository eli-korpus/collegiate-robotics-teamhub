alter table pur_requests enable row level security;

create policy pur_requests_read on pur_requests for select to authenticated using (teamhub_in_team(team_id));
create policy pur_requests_insert on pur_requests for insert to authenticated
  with check (teamhub_can('purchases.request', team_id) and requested_by = (select auth.uid()) and status = 'requested');
create policy pur_requests_update on pur_requests for update to authenticated
  using (teamhub_can('purchases.order', team_id) or teamhub_can('purchases.decline', team_id)
         or (requested_by = (select auth.uid()) and status = 'requested'))
  with check (teamhub_can('purchases.request', team_id) or teamhub_can('purchases.order', team_id) or teamhub_can('purchases.decline', team_id));
create policy pur_requests_delete on pur_requests for delete to authenticated
  using (teamhub_can('purchases.order', team_id) or (requested_by = (select auth.uid()) and status = 'requested'));
