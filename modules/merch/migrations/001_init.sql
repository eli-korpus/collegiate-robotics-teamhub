-- Merch & Orders (spec §13.28). Payments happen outside TeamHub; only a "paid" checkbox is stored.
create table mer_drives (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 2000),
  -- [{ id, name, price (text, e.g. "$18"), sizes: ["S","M",…] (empty = one size) }]
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array'),
  closes_at timestamptz,
  status text not null default 'open' check (status in ('open', 'closed', 'delivered')),
  season text not null default teamhub_season(),
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table mer_orders (
  id uuid primary key default gen_random_uuid(),
  drive_id uuid not null references mer_drives (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  -- [{ item, size, qty }]
  lines jsonb not null default '[]' check (jsonb_typeof(lines) = 'array'),
  paid boolean not null default false,
  delivered boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (drive_id, user_id)
);

-- Members can't mark their own order paid/delivered, and can't change it after the drive closes.
-- Not security definer: current_user must be the caller's role.
create or replace function mer_guard() returns trigger
language plpgsql set search_path = public as $$
declare v_team uuid; v_open boolean; v_manage boolean;
begin
  new.updated_at := now();
  if current_user not in ('authenticated', 'anon') then return new; end if;
  select team_id, status = 'open' and (closes_at is null or closes_at > now()) into v_team, v_open from mer_drives where id = new.drive_id;
  v_manage := teamhub_can('merch.manage', v_team);
  if not teamhub_can('merch.mark_paid', v_team) then
    new.paid := case when tg_op = 'UPDATE' then old.paid else false end;
  end if;
  if not v_manage then
    new.delivered := case when tg_op = 'UPDATE' then old.delivered else false end;
    if not v_open and (tg_op = 'INSERT' or new.lines is distinct from old.lines) then
      raise exception 'This order drive is closed' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger mer_orders_guard before insert or update on mer_orders for each row execute function mer_guard();
