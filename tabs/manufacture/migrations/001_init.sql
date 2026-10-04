-- To Manufacture (spec §13.13): jobs routed to method managers (positions), files auto-deleted after done.
create table mfg_jobs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  method text not null check (method ~ '^[a-z0-9_]+$'),
  qty smallint not null default 1 check (qty between 1 and 999),
  material text check (char_length(material) <= 60),
  color text check (char_length(color) <= 40),
  priority smallint not null default 1 check (priority between 0 and 3),
  needed_by date,
  status text not null default 'submitted' check (status in ('submitted', 'queued', 'in_progress', 'done', 'failed', 'cancelled')),
  params text check (char_length(params) <= 500),
  notes text check (char_length(notes) <= 2000),
  onshape_url text check (onshape_url ~* '^https?://'),
  keep_files boolean not null default false,
  requested_by uuid references profiles (id) on delete set null,
  assigned_to uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  done_at timestamptz,
  season text not null default teamhub_season()
);
create index mfg_jobs_status_idx on mfg_jobs (status, method);

create table mfg_files (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references mfg_jobs (id) on delete cascade,
  path text not null,
  name text not null check (char_length(name) <= 200),
  size_bytes bigint not null default 0,
  compressed boolean not null default false
);
create index mfg_files_job_idx on mfg_files (job_id);

create or replace function mfg_can_manage(p_method text, p_team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select teamhub_can('manufacture.manage_' || p_method, p_team) or teamhub_can('manufacture.delete_any', p_team)
$$;

-- Requesters may only edit their own job while it is still "submitted", and never its status.
create or replace function mfg_before_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'done' and old.status <> 'done' then new.done_at := now(); end if;
  if new.status <> 'done' then new.done_at := null; end if;
  if current_user in ('authenticated', 'anon') and not mfg_can_manage(old.method, old.team_id) then
    if old.status <> 'submitted' or new.status not in ('submitted', 'cancelled') or new.assigned_to is distinct from old.assigned_to then
      raise exception 'Only the people who run this machine can change the job status' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger mfg_jobs_guard before update on mfg_jobs for each row execute function mfg_before_update();

create or replace function mfg_after_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform teamhub_notify(array(select teamhub_users_with('manufacture.manage_' || new.method, new.team_id)), 'manufacture.new_job', 'manufacture:job:' || new.id);
  elsif new.status is distinct from old.status then
    perform teamhub_notify(array[new.requested_by], 'manufacture.status', 'manufacture:job:' || new.id);
  end if;
  return new;
end $$;
create trigger mfg_jobs_notify after insert or update of status on mfg_jobs for each row execute function mfg_after_write();

create or replace function mfg_on_file_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform teamhub_trash('manufacture', array[old.path]);
  return old;
end $$;
create trigger mfg_files_cleanup after delete on mfg_files for each row execute function mfg_on_file_delete();

create or replace function mfg_on_job_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from comments where ref = 'manufacture:job:' || old.id;
  return old;
end $$;
create trigger mfg_jobs_cleanup after delete on mfg_jobs for each row execute function mfg_on_job_delete();
