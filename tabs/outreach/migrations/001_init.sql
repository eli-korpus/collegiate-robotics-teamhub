-- Outreach Log (spec §13.24): events, hours and people reached.
create table out_events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  date date not null,
  starts_at timestamptz,
  ends_at timestamptz,
  kind text not null default 'demo' check (char_length(kind) <= 40),
  location text check (char_length(location) <= 160),
  people_reached int check (people_reached between 0 and 1000000),
  description text check (char_length(description) <= 4000),
  season text not null default teamhub_season(),
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index out_events_season_idx on out_events (season, date desc);

create table out_hours (
  event_id uuid not null references out_events (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  hours numeric(4, 1) not null check (hours > 0 and hours <= 24),
  approved boolean not null default false,
  approved_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index out_hours_user_idx on out_hours (user_id);

-- Only approvers can approve; editing your own hours sends them back for approval.
-- Not security definer: current_user must be the caller's role.
create or replace function out_hours_guard() returns trigger
language plpgsql set search_path = public as $$
declare v_team uuid;
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  select team_id into v_team from out_events where id = new.event_id;
  if teamhub_can('outreach.approve_hours', v_team) then
    new.approved_by := case when new.approved then coalesce(new.approved_by, auth.uid()) else null end;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.hours = old.hours and new.approved = old.approved then return new; end if;
  new.approved := false;
  new.approved_by := null;
  return new;
end $$;
create trigger out_hours_guard before insert or update on out_hours for each row execute function out_hours_guard();
