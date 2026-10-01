-- Events & Results (spec §13.19): data comes from FTCScout; only the team's own notes are stored.
create table evt_notes (
  team_id uuid not null references teams (id) on delete cascade,
  season int not null,
  event_code text not null check (char_length(event_code) <= 20),
  notes text not null default '' check (char_length(notes) <= 5000),
  updated_by uuid references profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (team_id, season, event_code)
);
