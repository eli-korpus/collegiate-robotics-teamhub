-- Engineering Notebook (spec §13.10): log entries and design iterations in one place.
create table nb_subsystems (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  sort int not null default 0
);

create table nb_entries (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams (id) on delete cascade,
  kind text not null default 'log' check (kind in ('log', 'iteration')),
  date date not null default current_date,
  title text not null check (char_length(title) between 1 and 160),
  body text not null default '' check (char_length(body) <= 20000),
  subsystem_id uuid references nb_subsystems (id) on delete set null,
  version_label text check (char_length(version_label) <= 20),
  why text check (char_length(why) <= 4000),
  onshape_url text check (onshape_url ~* '^https?://'),
  decision_matrix jsonb,
  tags text[] not null default '{}',
  authors uuid[] not null default '{}',
  season text not null default teamhub_season(),
  refs text[] not null default '{}',
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index nb_entries_date_idx on nb_entries (date desc);
create index nb_entries_subsystem_idx on nb_entries (subsystem_id);

create table nb_images (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references nb_entries (id) on delete cascade,
  path text not null,
  caption text check (char_length(caption) <= 200),
  sort int not null default 0
);
create index nb_images_entry_idx on nb_images (entry_id);

create or replace function nb_on_image_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform teamhub_trash('notebook', array[old.path]);
  return old;
end $$;
create trigger nb_images_cleanup after delete on nb_images for each row execute function nb_on_image_delete();

create or replace function nb_on_entry_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from comments where ref = 'notebook:entry:' || old.id;
  return old;
end $$;
create trigger nb_entries_cleanup after delete on nb_entries for each row execute function nb_on_entry_delete();

create or replace function nb_can_edit(e nb_entries) returns boolean
language sql stable security definer set search_path = public as $$
  select teamhub_can('notebook.edit_any', e.team_id)
    or ((e.created_by = auth.uid() or auth.uid() = any (e.authors)) and teamhub_can('notebook.write', e.team_id))
$$;
