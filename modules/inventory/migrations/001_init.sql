-- Parts Inventory (spec §13.11).
create table inv_items (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  sku text check (char_length(sku) <= 60),
  vendor text check (char_length(vendor) <= 60),
  url text check (url ~* '^https?://'),
  location text check (char_length(location) <= 60),
  qty int not null default 0 check (qty >= 0),
  low_at int check (low_at >= 0),
  category text check (char_length(category) <= 60),
  notes text check (char_length(notes) <= 500),
  updated_at timestamptz not null default now()
);
create index inv_items_name_idx on inv_items (lower(name));

-- Atomic +/- for people who may only change quantities.
create or replace function inv_adjust(p_item uuid, p_delta int) returns int
language plpgsql security definer set search_path = public as $$
declare t uuid; q int;
begin
  select team_id into t from inv_items where id = p_item;
  if not found then raise exception 'Part not found'; end if;
  if not teamhub_can('inventory.edit_qty', t) then raise exception 'Not allowed' using errcode = '42501'; end if;
  update inv_items set qty = greatest(0, qty + p_delta), updated_at = now() where id = p_item returning qty into q;
  return q;
end $$;
