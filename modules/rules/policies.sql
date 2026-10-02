alter table rule_items enable row level security;
create policy rule_items_read on rule_items for select to authenticated using (teamhub_is_active());
create policy rule_items_insert on rule_items for insert to authenticated
  with check (teamhub_can('rules.post', null) and created_by = (select auth.uid()) and (kind = 'question' or teamhub_can('rules.answer', null) or answer is null));
create policy rule_items_update on rule_items for update to authenticated
  using (teamhub_can('rules.answer', null) or (created_by = (select auth.uid()) and answer is null)) with check (true);
create policy rule_items_delete on rule_items for delete to authenticated
  using (teamhub_can('rules.answer', null) or (created_by = (select auth.uid()) and answer is null));
