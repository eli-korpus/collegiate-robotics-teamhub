alter table soc_posts enable row level security;
create policy soc_posts_read on soc_posts for select to authenticated using (teamhub_in_team(team_id));
create policy soc_posts_insert on soc_posts for insert to authenticated with check (teamhub_can('social.draft', team_id) and created_by = (select auth.uid()));
create policy soc_posts_change on soc_posts for update to authenticated
  using (teamhub_can('social.draft', team_id) or teamhub_can('social.approve', team_id) or teamhub_can('social.mark_posted', team_id))
  with check (teamhub_can('social.draft', team_id) or teamhub_can('social.approve', team_id) or teamhub_can('social.mark_posted', team_id));
create policy soc_posts_delete on soc_posts for delete to authenticated using (created_by = (select auth.uid()) or teamhub_can('social.approve', team_id));
