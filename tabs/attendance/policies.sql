alter table att_sessions enable row level security;
alter table att_presence enable row level security;
alter table att_codes enable row level security;

create policy att_sessions_read on att_sessions for select to authenticated using (teamhub_in_team(team_id));
create policy att_sessions_insert on att_sessions for insert to authenticated
  with check (teamhub_can('attendance.take', team_id) and created_by = (select auth.uid()));
create policy att_sessions_update on att_sessions for update to authenticated
  using ((teamhub_can('attendance.take', team_id) and date >= current_date - 1) or teamhub_can('attendance.edit', team_id))
  with check (teamhub_can('attendance.take', team_id) or teamhub_can('attendance.edit', team_id));
create policy att_sessions_delete on att_sessions for delete to authenticated
  using (teamhub_can('attendance.edit', team_id) or (created_by = (select auth.uid()) and date >= current_date - 1));

-- Members see only their own record; takers/view_all see everyone's (spec §13.1 visibility).
create policy att_presence_read on att_presence for select to authenticated using (
  user_id = (select auth.uid())
  or exists (select 1 from att_sessions s where s.id = session_id
             and (teamhub_can('attendance.view_all', s.team_id) or teamhub_can('attendance.take', s.team_id)))
);
create policy att_presence_write on att_presence for all to authenticated
  using (exists (select 1 from att_sessions s where s.id = session_id
                 and ((teamhub_can('attendance.take', s.team_id) and s.date >= current_date - 1) or teamhub_can('attendance.edit', s.team_id))))
  with check (exists (select 1 from att_sessions s where s.id = session_id
                 and ((teamhub_can('attendance.take', s.team_id) and s.date >= current_date - 1) or teamhub_can('attendance.edit', s.team_id))));
-- att_codes: no client policies; only definer functions touch it.
