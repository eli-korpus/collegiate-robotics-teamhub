-- Parts used by a repair (durable link, so it lives in the integration, spec §4.4).
create table ix_repinv_parts (
  issue_id uuid not null references rep_issues (id) on delete cascade,
  item_id uuid not null references inv_items (id) on delete cascade,
  qty int not null default 1 check (qty > 0),
  primary key (issue_id, item_id)
);

create or replace function ix_repinv_use(p_issue uuid, p_item uuid, p_qty int) returns void
language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  select team_id into t from rep_issues where id = p_issue;
  if not (teamhub_can('repairs.report', t) and teamhub_can('inventory.edit_qty', t)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into ix_repinv_parts (issue_id, item_id, qty) values (p_issue, p_item, p_qty)
  on conflict (issue_id, item_id) do update set qty = ix_repinv_parts.qty + excluded.qty;
  update inv_items set qty = greatest(0, qty - p_qty), updated_at = now() where id = p_item;
end $$;
