-- Sponsors CRM (spec §13.25): relationships and follow-ups, never money accounting.
create table spn_sponsors (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  contact_name text check (char_length(contact_name) <= 120),
  contact_email text check (char_length(contact_email) <= 200),
  website text check (website ~* '^https?://'),
  status text not null default 'prospect' check (status in ('prospect', 'asked', 'committed', 'declined', 'past')),
  tier text check (char_length(tier) <= 40),
  gave text check (char_length(gave) <= 300),
  thanked boolean not null default false,
  next_step text check (char_length(next_step) <= 300),
  next_step_date date,
  owner uuid references profiles (id) on delete set null,
  notes text check (char_length(notes) <= 4000),
  season text not null default teamhub_season(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index spn_sponsors_next_idx on spn_sponsors (next_step_date) where next_step_date is not null;
