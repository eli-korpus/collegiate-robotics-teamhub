-- Judging Prep (spec §13.22): interview practice + award evidence. No award names are built in.
create table jdg_questions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams (id) on delete cascade,
  question text not null check (char_length(question) between 1 and 300),
  notes text check (char_length(notes) <= 2000),
  tags text[] not null default '{}',
  owner uuid references profiles (id) on delete set null
);

create table jdg_criteria (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams (id) on delete cascade,
  award text not null check (char_length(award) between 1 and 80),
  criterion text not null check (char_length(criterion) between 1 and 300),
  evidence text[] not null default '{}',
  season text not null default teamhub_season(),
  sort int not null default 0
);
