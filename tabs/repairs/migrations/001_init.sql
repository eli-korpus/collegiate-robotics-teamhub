-- Repair & Issue Log (spec §13.17).
create table rep_issues (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  subsystem_text text check (char_length(subsystem_text) <= 60),
  severity smallint not null default 2 check (severity between 1 and 3),
  status text not null default 'open' check (status in ('open', 'fixed', 'wontfix')),
  happened_at timestamptz not null default now(),
  event_label text check (char_length(event_label) <= 80),
  cause text check (char_length(cause) <= 3000),
  fix text check (char_length(fix) <= 3000),
  reported_by uuid references profiles (id) on delete set null,
  fixed_by uuid references profiles (id) on delete set null,
  image_path text,
  season text not null default teamhub_season(),
  created_at timestamptz not null default now()
);
create index rep_issues_status_idx on rep_issues (status, happened_at desc);

create or replace function rep_on_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from comments where ref = 'repairs:issue:' || old.id;
  if old.image_path is not null then perform teamhub_trash('repairs', array[old.image_path]); end if;
  return old;
end $$;
create trigger rep_issues_cleanup after delete on rep_issues for each row execute function rep_on_delete();
