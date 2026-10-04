alter table sign_sheets enable row level security;
alter table sign_slots enable row level security;
alter table sign_claims enable row level security;
create policy sign_sheets_read on sign_sheets for select to authenticated using (teamhub_in_team(team_id));
create policy sign_sheets_insert on sign_sheets for insert to authenticated with check (teamhub_can('signups.create', team_id) and created_by = (select auth.uid()));
create policy sign_sheets_change on sign_sheets for update to authenticated
  using (created_by = (select auth.uid()) or teamhub_can('signups.manage_claims', team_id))
  with check (teamhub_can('signups.create', team_id) or teamhub_can('signups.manage_claims', team_id));
create policy sign_sheets_delete on sign_sheets for delete to authenticated using (created_by = (select auth.uid()) or teamhub_can('signups.manage_claims', team_id));

create policy sign_slots_read on sign_slots for select to authenticated using (exists (select 1 from sign_sheets s where s.id = sheet_id and teamhub_in_team(s.team_id)));
create policy sign_slots_write on sign_slots for all to authenticated
  using (exists (select 1 from sign_sheets s where s.id = sheet_id and (s.created_by = (select auth.uid()) or teamhub_can('signups.manage_claims', s.team_id))))
  with check (exists (select 1 from sign_sheets s where s.id = sheet_id and (s.created_by = (select auth.uid()) or teamhub_can('signups.manage_claims', s.team_id))));

-- Claims are visible to everyone in scope (stated in the UI).
create policy sign_claims_read on sign_claims for select to authenticated using (
  exists (select 1 from sign_slots sl join sign_sheets s on s.id = sl.sheet_id where sl.id = slot_id and teamhub_in_team(s.team_id)));
create policy sign_claims_insert on sign_claims for insert to authenticated with check (
  exists (select 1 from sign_slots sl join sign_sheets s on s.id = sl.sheet_id where sl.id = slot_id and (
    teamhub_can('signups.manage_claims', s.team_id)
    or (user_id = (select auth.uid()) and teamhub_can('signups.claim', s.team_id) and (s.closes_at is null or s.closes_at > now())))));
create policy sign_claims_delete on sign_claims for delete to authenticated using (
  user_id = (select auth.uid())
  or exists (select 1 from sign_slots sl join sign_sheets s on s.id = sl.sheet_id where sl.id = slot_id and teamhub_can('signups.manage_claims', s.team_id)));
