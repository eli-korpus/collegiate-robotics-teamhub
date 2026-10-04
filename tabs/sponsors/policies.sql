alter table spn_sponsors enable row level security;
-- The whole tab is captains + mentors only (spec §13.25).
create policy spn_sponsors_read on spn_sponsors for select to authenticated using (teamhub_can('sponsors.view', team_id) or teamhub_can('sponsors.manage', team_id));
create policy spn_sponsors_write on spn_sponsors for all to authenticated using (teamhub_can('sponsors.manage', team_id)) with check (teamhub_can('sponsors.manage', team_id));
