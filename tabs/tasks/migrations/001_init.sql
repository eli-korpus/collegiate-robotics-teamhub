-- Tasks (spec §13.5).
create table task_items (
  id bigint generated always as identity primary key,
  team_id uuid references teams (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 5000),
  status text not null default 'todo' check (status in ('todo', 'doing', 'review', 'done')),
  assignee uuid[] not null default '{}' check (coalesce(array_length(assignee, 1), 0) <= 5),
  subteam_id text references subteams (id) on delete set null,
  position_id text references positions (id) on delete set null,
  due date,
  priority smallint not null default 1 check (priority between 0 and 3),
  sort real not null default 0,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index task_items_status_idx on task_items (status, due);
create index task_items_assignee_idx on task_items using gin (assignee);

-- Assignment rules + done_at bookkeeping. Changing who is assigned needs tasks.assign
-- (or assigning only yourself); assignees may change status of their own tasks.
-- Not security definer: it must see the real caller (current_user) to enforce the rule.
create or replace function task_before_write() returns trigger
language plpgsql set search_path = public as $$
declare added uuid[];
begin
  if current_user in ('authenticated', 'anon') then
    added := array(select unnest(new.assignee) except select unnest(case when tg_op = 'UPDATE' then old.assignee else '{}'::uuid[] end));
    if coalesce(array_length(added, 1), 0) > 0 and not (added <@ array[auth.uid()]) and not teamhub_can('tasks.assign', new.team_id) then
      raise exception 'You can only assign tasks to yourself' using errcode = '42501';
    end if;
  end if;
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then new.done_at := now();
  elsif new.status <> 'done' then new.done_at := null;
  end if;
  return new;
end $$;
create trigger task_items_guard before insert or update on task_items for each row execute function task_before_write();

create or replace function task_after_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform teamhub_notify(
    array(select unnest(new.assignee) except select unnest(case when tg_op = 'UPDATE' then old.assignee else '{}'::uuid[] end)),
    'tasks.assigned', 'tasks:task:' || new.id);
  return new;
end $$;
create trigger task_items_notify after insert or update of assignee on task_items for each row execute function task_after_write();

create or replace function task_on_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from comments where ref = 'tasks:task:' || old.id;
  return old;
end $$;
create trigger task_items_cleanup after delete on task_items for each row execute function task_on_delete();

-- Comment on a task → notify its assignees (spec §13.5).
create or replace function task_on_comment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform teamhub_notify(
    (select assignee from task_items where 'tasks:task:' || id = new.ref),
    'tasks.comment', new.ref);
  return new;
end $$;
create trigger task_comments_notify after insert on comments for each row
  when (new.ref like 'tasks:task:%') execute function task_on_comment();
