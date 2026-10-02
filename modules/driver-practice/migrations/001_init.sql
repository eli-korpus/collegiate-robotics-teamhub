-- Driver Practice Log (spec §13.16). Metrics are team-defined (season-agnostic).
create table drv_fields (
  id smallint primary key default 1 check (id = 1),
  fields jsonb not null default '[]'
);
insert into drv_fields (id) values (1) on conflict do nothing;

create table drv_runs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams (id) on delete cascade,
  date date not null default current_date,
  driver uuid references profiles (id) on delete set null,
  operator uuid references profiles (id) on delete set null,
  kind text not null default 'full' check (char_length(kind) <= 30),
  score int,
  auto_score int,
  metrics jsonb not null default '{}',
  notes text check (char_length(notes) <= 1000),
  season text not null default teamhub_season(),
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index drv_runs_date_idx on drv_runs (date desc);
