alter table comp_active enable row level security;
create policy comp_active_read on comp_active for select to authenticated using (teamhub_in_team(team_id));
create policy comp_active_write on comp_active for all to authenticated
  using (teamhub_can('competition-day.set_event', team_id)) with check (teamhub_can('competition-day.set_event', team_id));

alter table comp_history enable row level security;
create policy comp_history_read on comp_history for select to authenticated using (teamhub_in_team(team_id));
-- Past event data is kept; only admins can delete it.
create policy comp_history_delete on comp_history for delete to authenticated using (teamhub_is_admin());
