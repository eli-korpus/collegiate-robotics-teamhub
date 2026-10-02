-- Code Hub (spec §13.18): OpModes and their gamepad mappings. Code itself lives on GitHub.
create table code_opmodes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null default 'teleop' check (kind in ('auto', 'teleop', 'test')),
  description text check (char_length(description) <= 2000),
  status text not null default 'wip' check (status in ('working', 'wip', 'broken', 'retired')),
  gamepad_map jsonb not null default '{}',
  sort int not null default 0,
  updated_at timestamptz not null default now()
);
