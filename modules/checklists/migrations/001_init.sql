-- Checklists (spec §13.15): lists hold items as compact jsonb; each run records checked item ids.
create table chk_lists (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null default 'other' check (kind in ('robot', 'pit', 'packing', 'inspection', 'judging', 'portfolio', 'other')),
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 200),
  sort int not null default 0,
  created_by uuid references profiles (id) on delete set null
);

create table chk_runs (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references chk_lists (id) on delete cascade,
  label text check (char_length(label) <= 60),
  checked jsonb not null default '[]' check (jsonb_typeof(checked) = 'array'),
  started_by uuid references profiles (id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index chk_runs_list_idx on chk_runs (list_id, started_at desc);

-- Toggle one item atomically so two people can run a list together (realtime).
create or replace function chk_toggle(p_run uuid, p_item text, p_on boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r chk_runs; l chk_lists; v_checked jsonb;
begin
  select * into r from chk_runs where id = p_run for update;
  if not found then raise exception 'Run not found'; end if;
  select * into l from chk_lists where id = r.list_id;
  if not teamhub_can('checklists.run', l.team_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  v_checked := case when p_on then (select coalesce(jsonb_agg(distinct x), '[]') from jsonb_array_elements_text(r.checked || to_jsonb(p_item)) x)
               else (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements_text(r.checked) x where x <> p_item) end;
  update chk_runs set checked = v_checked,
    completed_at = case when jsonb_array_length(v_checked) >= jsonb_array_length(l.items) then coalesce(completed_at, now()) else null end
  where id = p_run;
  return v_checked;
end $$;

select teamhub_realtime_add('chk_runs');
