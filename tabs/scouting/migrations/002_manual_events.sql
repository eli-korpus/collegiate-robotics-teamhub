-- Events that aren't on FTCScout (scrimmages, off-season, brand-new events): name + list of team numbers.
create table sct_events (
  season text not null default teamhub_season(),
  code text not null check (code ~ '^[A-Za-z0-9_-]{2,20}$'),
  name text not null check (char_length(name) between 1 and 120),
  start_date date,
  teams int[] not null default '{}' check (coalesce(array_length(teams, 1), 0) <= 200),
  created_by uuid references profiles (id) on delete set null,
  primary key (season, code)
);
