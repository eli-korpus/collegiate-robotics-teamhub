-- Sign-up Sheets (spec §13.8): claim one of a limited number of slots.
create table sign_sheets (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 2000),
  event_ref text check (char_length(event_ref) <= 120),
  closes_at timestamptz,
  season text not null default teamhub_season(),
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table sign_slots (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references sign_sheets (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  starts_at timestamptz,
  capacity smallint not null default 1 check (capacity between 1 and 200),
  sort int not null default 0
);
create index sign_slots_sheet_idx on sign_slots (sheet_id, sort);

create table sign_claims (
  slot_id uuid not null references sign_slots (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  claimed_at timestamptz not null default now(),
  primary key (slot_id, user_id)
);
create index sign_claims_user_idx on sign_claims (user_id);

-- Capacity is enforced in the database (two people can't take the last spot at once).
create or replace function sign_check_capacity() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cap int; v_taken int;
begin
  select capacity into v_cap from sign_slots where id = new.slot_id for update;
  select count(*) into v_taken from sign_claims where slot_id = new.slot_id;
  if v_taken >= v_cap then raise exception 'That slot is full' using errcode = 'P0001'; end if;
  return new;
end $$;
create trigger sign_claims_capacity before insert on sign_claims for each row execute function sign_check_capacity();
