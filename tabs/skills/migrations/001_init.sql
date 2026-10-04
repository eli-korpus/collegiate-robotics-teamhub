-- Skills & Training (spec §13.9): proven abilities with a sign-off.
create table skill_skills (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  category text check (char_length(category) <= 40),
  subteam_id text references subteams (id) on delete set null,
  description text check (char_length(description) <= 2000),
  url text check (url ~* '^https?://'),
  -- skills that should be signed off first ("Drill press safety" before "CNC basics")
  requires uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table skill_signoffs (
  skill_id uuid not null references skill_skills (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  signed_by uuid references profiles (id) on delete set null,
  signed_at timestamptz not null default now(),
  primary key (skill_id, user_id)
);
create index skill_signoffs_user_idx on skill_signoffs (user_id);
