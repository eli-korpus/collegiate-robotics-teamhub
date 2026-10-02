-- Polls & Availability (spec §13.7). Visibility is chosen first and enforced by RLS + a totals RPC.
create table poll_polls (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams (id) on delete cascade,
  kind text not null check (kind in ('choice', 'availability', 'text')),
  question text not null check (char_length(question) between 1 and 300),
  options jsonb not null default '[]',
  multi boolean not null default false,
  visibility text not null check (visibility in ('public', 'results', 'private')),
  closes_at timestamptz,
  result jsonb,
  -- optional entity ref (e.g. calendar:event:<id>) — shown with EntityLink; no FK so modules stay independent
  ref text check (char_length(ref) <= 120),
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- short text answers are never public (they could expose personal info)
  check (kind <> 'text' or visibility <> 'public')
);

create table poll_votes (
  poll_id uuid not null references poll_polls (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  value jsonb not null,
  voted_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create or replace function poll_can_see_votes(p poll_polls) returns boolean
language sql stable security definer set search_path = public as $$
  select p.created_by = auth.uid()
    or teamhub_can('polls.view_private_results', p.team_id)
    or (p.visibility = 'public' and teamhub_in_team(p.team_id))
$$;

-- Aggregated totals for anyone in scope on public/results polls (individual answers stay hidden).
-- choice: {"counts": [n per option], "voters": n}; availability: {"counts": [n per cell], "voters": n}; text: count only.
create or replace function poll_totals(p_poll uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p poll_polls; n int; counts jsonb;
begin
  select * into p from poll_polls where id = p_poll;
  if not found or not teamhub_in_team(p.team_id) then return null; end if;
  if p.visibility = 'private' and not poll_can_see_votes(p) then return null; end if;
  if p.result is not null and not exists (select 1 from poll_votes where poll_id = p_poll) then return p.result; end if;
  select count(*) into n from poll_votes where poll_id = p_poll;
  if p.kind = 'choice' then
    select coalesce(jsonb_agg(c order by i), '[]') into counts from (
      select i, (select count(*) from poll_votes v where v.poll_id = p_poll and v.value @> to_jsonb(array[i - 1])) c
      from generate_series(1, jsonb_array_length(p.options)) i) x;
  elsif p.kind = 'availability' then
    select coalesce(jsonb_agg(c order by i), '[]') into counts from (
      select i, (select count(*) from poll_votes v where v.poll_id = p_poll and substr(v.value #>> '{}', i, 1) = '1') c
      from generate_series(1, (select coalesce(max(length(value #>> '{}')), 0) from poll_votes where poll_id = p_poll)) i) x;
  else counts := '[]';
  end if;
  return jsonb_build_object('counts', counts, 'voters', n);
end $$;

-- Before answers are pruned, store the totals so results stay visible.
create or replace function poll_finalize() returns void
language plpgsql security definer set search_path = public as $$
declare p poll_polls;
begin
  for p in select * from poll_polls where closes_at < now() - interval '30 days' and exists (select 1 from poll_votes where poll_id = poll_polls.id) loop
    update poll_polls set result = (
      select jsonb_build_object('voters', count(*), 'counts',
        case when p.kind = 'choice' then (select coalesce(jsonb_agg(c order by i), '[]') from (select i, (select count(*) from poll_votes v where v.poll_id = p.id and v.value @> to_jsonb(array[i - 1])) c from generate_series(1, jsonb_array_length(p.options)) i) x)
             when p.kind = 'availability' then (select coalesce(jsonb_agg(c order by i), '[]') from (select i, (select count(*) from poll_votes v where v.poll_id = p.id and substr(v.value #>> '{}', i, 1) = '1') c from generate_series(1, (select coalesce(max(length(value #>> '{}')), 0) from poll_votes where poll_id = p.id)) i) x)
             else '[]'::jsonb end)
      from poll_votes where poll_id = p.id) where id = p.id;
    delete from poll_votes where poll_id = p.id;
  end loop;
end $$;
revoke execute on function poll_finalize() from public, anon, authenticated;
