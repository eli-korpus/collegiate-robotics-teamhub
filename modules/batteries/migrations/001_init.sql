-- Battery Tracker (spec §13.14).
create table bat_batteries (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 40),
  type text check (char_length(type) <= 60),
  purchased date,
  retired boolean not null default false,
  notes text check (char_length(notes) <= 500)
);

create table bat_logs (
  id bigint generated always as identity primary key,
  battery_id uuid not null references bat_batteries (id) on delete cascade,
  kind text not null check (kind in ('charged', 'tested', 'used', 'note')),
  voltage numeric(4, 2) check (voltage between 0 and 20),
  note text check (char_length(note) <= 300),
  at timestamptz not null default now(),
  by uuid references profiles (id) on delete set null
);
create index bat_logs_battery_idx on bat_logs (battery_id, at desc);

-- Keep only the latest 200 log rows per battery.
create or replace function bat_prune() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from bat_logs where battery_id = new.battery_id and id in (
    select id from bat_logs where battery_id = new.battery_id order by at desc, id desc offset 200);
  return null;
end $$;
create trigger bat_logs_prune after insert on bat_logs for each row execute function bat_prune();
