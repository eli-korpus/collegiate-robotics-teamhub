-- Competition Day (spec §13.20): one overwritten row per team.
create table comp_active (
  team_id uuid primary key references teams (id) on delete cascade,
  event_code text not null check (char_length(event_code) between 1 and 20),
  season int not null,
  pit_notes text not null default '' check (char_length(pit_notes) <= 2000),
  updated_by uuid references profiles (id) on delete set null,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Pit notes can be edited by members without letting them change the event.
create or replace function comp_set_notes(p_team uuid, p_notes text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not teamhub_can('competition-day.edit_pit_notes', p_team) then raise exception 'Not allowed' using errcode = '42501'; end if;
  update comp_active set pit_notes = left(coalesce(p_notes, ''), 2000), updated_by = auth.uid(), updated_at = now() where team_id = p_team;
end $$;

select teamhub_realtime_add('comp_active');

-- History of events the team attended (kept until an admin deletes it). Filled automatically when the active event
-- changes or is cleared, so pit notes from past events are never lost.
create table comp_history (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id) on delete cascade,
  season int not null,
  event_code text not null,
  pit_notes text not null default '',
  started_at timestamptz not null,
  ended_at timestamptz not null default now()
);
create index comp_history_team_idx on comp_history (team_id, ended_at desc);

create or replace function comp_archive() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' or new.event_code is distinct from old.event_code or new.season is distinct from old.season then
    insert into comp_history (team_id, season, event_code, pit_notes, started_at)
    values (old.team_id, old.season, old.event_code, old.pit_notes, coalesce(old.started_at, old.updated_at));
    if tg_op = 'UPDATE' then
      new.pit_notes := '';
      new.started_at := now();
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger comp_active_archive before update or delete on comp_active for each row execute function comp_archive();
