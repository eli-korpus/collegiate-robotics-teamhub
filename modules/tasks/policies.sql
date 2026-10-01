alter table task_items enable row level security;

create policy task_items_read on task_items for select to authenticated using (teamhub_in_team(team_id));
create policy task_items_insert on task_items for insert to authenticated
  with check (teamhub_can('tasks.create', team_id) and created_by = (select auth.uid()));
create policy task_items_update on task_items for update to authenticated
  using (
    teamhub_can('tasks.edit_any', team_id)
    or (created_by = (select auth.uid()) and teamhub_can('tasks.create', team_id))
    or ((select auth.uid()) = any (assignee) and teamhub_in_team(team_id))
  )
  with check (teamhub_in_team(team_id));
create policy task_items_delete on task_items for delete to authenticated
  using (teamhub_can('tasks.delete_any', team_id) or (created_by = (select auth.uid()) and teamhub_can('tasks.create', team_id)));
