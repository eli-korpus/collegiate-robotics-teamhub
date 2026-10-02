-- Paperwork Tracker (spec §13.6): status only — documents are never uploaded.
create table ppr_items (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  url text check (url ~* '^https?://'),
  due date,
  season text not null default teamhub_season(),
  applies_to text not null default 'members' check (applies_to in ('members', 'everyone')),
  created_at timestamptz not null default now()
);

-- A row exists only when something was turned in.
create table ppr_done (
  item_id uuid not null references ppr_items (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  done_at timestamptz not null default now(),
  marked_by uuid references profiles (id) on delete set null,
  primary key (item_id, user_id)
);
