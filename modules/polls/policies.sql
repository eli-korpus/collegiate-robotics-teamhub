alter table poll_polls enable row level security;
alter table poll_votes enable row level security;
create policy poll_polls_read on poll_polls for select to authenticated using (teamhub_in_team(team_id));
create policy poll_polls_insert on poll_polls for insert to authenticated with check (teamhub_can('polls.create', team_id) and created_by = (select auth.uid()));
create policy poll_polls_update on poll_polls for update to authenticated
  using (created_by = (select auth.uid()) or teamhub_is_admin())
  with check ((created_by = (select auth.uid()) or teamhub_is_admin()) and teamhub_in_team(team_id));
create policy poll_polls_delete on poll_polls for delete to authenticated using (created_by = (select auth.uid()) or teamhub_is_admin());

create policy poll_votes_read on poll_votes for select to authenticated using (
  user_id = (select auth.uid()) or exists (select 1 from poll_polls p where p.id = poll_id and poll_can_see_votes(p))
);
create policy poll_votes_write on poll_votes for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (
    select 1 from poll_polls p where p.id = poll_id and teamhub_in_team(p.team_id) and teamhub_can('polls.vote', p.team_id)
      and (p.closes_at is null or p.closes_at > now())));
