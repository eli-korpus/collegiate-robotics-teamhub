-- Using parts must name a positive quantity of a part from the same team as the issue (or a program-wide part).
create or replace function ix_repinv_use(p_issue uuid, p_item uuid, p_qty int) returns void
language plpgsql security definer set search_path = public as $$
declare t uuid; it uuid;
begin
  if p_qty is null or p_qty < 1 or p_qty > 1000 then raise exception 'Quantity must be between 1 and 1000'; end if;
  select team_id into t from rep_issues where id = p_issue;
  if not found then raise exception 'Issue not found'; end if;
  select team_id into it from inv_items where id = p_item;
  if not found then raise exception 'Part not found'; end if;
  if it is not null and it is distinct from t then raise exception 'That part belongs to another team' using errcode = '42501'; end if;
  if not (teamhub_can('repairs.report', t) and teamhub_can('inventory.edit_qty', it)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into ix_repinv_parts (issue_id, item_id, qty) values (p_issue, p_item, p_qty)
  on conflict (issue_id, item_id) do update set qty = ix_repinv_parts.qty + excluded.qty;
  update inv_items set qty = greatest(0, qty - p_qty), updated_at = now() where id = p_item;
end $$;
