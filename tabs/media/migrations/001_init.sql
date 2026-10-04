-- Media Gallery (spec §13.26): compressed photos + video/album links. Private bucket, signed URLs.
create table med_albums (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  date date not null default current_date,
  external_url text check (external_url ~* '^https?://'),
  season text not null default teamhub_season(),
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table med_items (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references med_albums (id) on delete cascade,
  kind text not null check (kind in ('photo', 'link')),
  path text,
  url text check (url ~* '^https?://'),
  caption text check (char_length(caption) <= 300),
  uploaded_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((kind = 'photo' and path is not null) or (kind = 'link' and url is not null))
);
create index med_items_album_idx on med_items (album_id, created_at);

-- Re-created by policies.sql with the configured limit.
create or replace function med_check_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'photo' and (select count(*) from med_items where album_id = new.album_id and kind = 'photo') >= 50 then
    raise exception 'This album is full (50 photos). Start a new album or link a Google Photos/Drive album.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger med_items_limit before insert on med_items for each row execute function med_check_limit();

create or replace function med_on_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.path is not null then perform teamhub_trash('media', array[old.path]); end if;
  return old;
end $$;
create trigger med_items_cleanup after delete on med_items for each row execute function med_on_delete();
