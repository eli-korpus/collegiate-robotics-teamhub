alter table out_events enable row level security;
alter table out_hours enable row level security;
create policy out_events_read on out_events for select to authenticated using (teamhub_in_team(team_id));
create policy out_events_insert on out_events for insert to authenticated with check (teamhub_can('outreach.create_event', team_id) and created_by = (select auth.uid()));
create policy out_events_change on out_events for update to authenticated
  using (created_by = (select auth.uid()) or teamhub_can('outreach.create_event', team_id)) with check (teamhub_can('outreach.create_event', team_id));
create policy out_events_delete on out_events for delete to authenticated using (created_by = (select auth.uid()) or teamhub_can('outreach.approve_hours', team_id));

create policy out_hours_read on out_hours for select to authenticated using (exists (select 1 from out_events e where e.id = event_id and teamhub_in_team(e.team_id)));
create policy out_hours_write on out_hours for all to authenticated
  using (exists (select 1 from out_events e where e.id = event_id and (
    (user_id = (select auth.uid()) and teamhub_can('outreach.log_hours', e.team_id)) or teamhub_can('outreach.approve_hours', e.team_id))))
  with check (exists (select 1 from out_events e where e.id = event_id and (
    (user_id = (select auth.uid()) and teamhub_can('outreach.log_hours', e.team_id)) or teamhub_can('outreach.approve_hours', e.team_id))));
