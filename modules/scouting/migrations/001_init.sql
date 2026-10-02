-- Scouting (spec §13.21): fully season-agnostic — teams build their own fields each season.
create table sct_templates (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('match', 'pit')),
  season text not null default teamhub_season(),
  fields jsonb not null default '[]',
  version int not null default 1,
  unique (kind, season)
);

create table sct_entries (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references sct_templates (id) on delete set null,
  template_version int not null default 1,
  kind text not null default 'match' check (kind in ('match', 'pit')),
  season text not null default teamhub_season(),
  event_code text not null check (char_length(event_code) between 1 and 20),
  match_label text check (char_length(match_label) <= 20),
  team_number int not null check (team_number > 0),
  data jsonb not null default '{}',
  scout uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index sct_entries_event_idx on sct_entries (event_code, team_number);

create table sct_picklist (
  event_code text not null,
  team_id uuid not null references teams (id) on delete cascade,
  ranking jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  primary key (event_code, team_id)
);

-- Bump the template version whenever its fields change, so old entries keep their meaning.
create or replace function sct_template_version() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.fields is distinct from old.fields then new.version := old.version + 1; end if;
  return new;
end $$;
create trigger sct_templates_version before update on sct_templates for each row execute function sct_template_version();
