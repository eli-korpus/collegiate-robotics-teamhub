alter table cal_events enable row level security;
alter table cal_exceptions enable row level security;
alter table cal_feeds enable row level security;

create policy cal_events_read on cal_events for select to authenticated
  using (teamhub_in_team(team_id) and teamhub_can('calendar.view', team_id));
create policy cal_events_insert on cal_events for insert to authenticated
  with check (teamhub_can('calendar.create', team_id) and created_by = (select auth.uid()));
create policy cal_events_update on cal_events for update to authenticated
  using ((created_by = (select auth.uid()) and teamhub_can('calendar.create', team_id)) or teamhub_can('calendar.edit_any', team_id))
  with check (teamhub_can('calendar.create', team_id) or teamhub_can('calendar.edit_any', team_id));
create policy cal_events_delete on cal_events for delete to authenticated
  using ((created_by = (select auth.uid()) and teamhub_can('calendar.create', team_id)) or teamhub_can('calendar.edit_any', team_id));

create policy cal_exceptions_read on cal_exceptions for select to authenticated
  using (exists (select 1 from cal_events e where e.id = event_id and teamhub_in_team(e.team_id)));
create policy cal_exceptions_write on cal_exceptions for all to authenticated
  using (exists (select 1 from cal_events e where e.id = event_id and
    ((e.created_by = (select auth.uid()) and teamhub_can('calendar.create', e.team_id)) or teamhub_can('calendar.edit_any', e.team_id))))
  with check (exists (select 1 from cal_events e where e.id = event_id and
    ((e.created_by = (select auth.uid()) and teamhub_can('calendar.create', e.team_id)) or teamhub_can('calendar.edit_any', e.team_id))));

create policy cal_feeds_admin on cal_feeds for all to authenticated using (teamhub_is_admin()) with check (teamhub_is_admin());

-- The iCal feed is served by the ical edge function (service role); members never call it directly.
revoke execute on function cal_ical(text) from public, anon, authenticated;
