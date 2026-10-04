alter table ann_posts enable row level security;
alter table ann_acks enable row level security;

create policy ann_posts_read on ann_posts for select to authenticated using (teamhub_in_team(team_id));
create policy ann_posts_insert on ann_posts for insert to authenticated
  with check (teamhub_can('announcements.post', team_id) and created_by = (select auth.uid()));
create policy ann_posts_update on ann_posts for update to authenticated
  using ((created_by = (select auth.uid()) and teamhub_can('announcements.post', team_id)) or teamhub_can('announcements.delete_any', team_id))
  with check (teamhub_can('announcements.post', team_id) or teamhub_can('announcements.delete_any', team_id));
create policy ann_posts_delete on ann_posts for delete to authenticated
  using ((created_by = (select auth.uid()) and teamhub_can('announcements.post', team_id)) or teamhub_can('announcements.delete_any', team_id));

create policy ann_acks_read on ann_acks for select to authenticated using (
  user_id = (select auth.uid())
  or exists (select 1 from ann_posts p where p.id = post_id and (p.created_by = (select auth.uid()) or teamhub_can('announcements.view_acks', p.team_id)))
);
create policy ann_acks_insert on ann_acks for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (select 1 from ann_posts p where p.id = post_id and p.require_ack and teamhub_in_team(p.team_id))
);
create policy ann_acks_delete on ann_acks for delete to authenticated using (user_id = (select auth.uid()));
