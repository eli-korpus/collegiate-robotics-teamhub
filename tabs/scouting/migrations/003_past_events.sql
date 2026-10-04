-- Past events: everything scouted stays until an admin deletes it.
create or replace function sct_event_summary() returns table (event_code text, season text, entries int, pit int, last_at timestamptz, name text)
language sql stable security definer set search_path = public as $$
  select e.event_code, e.season,
         count(*) filter (where e.kind = 'match')::int,
         count(*) filter (where e.kind = 'pit')::int,
         max(e.created_at),
         (select m.name from sct_events m where upper(m.code) = upper(e.event_code) and m.season = e.season)
  from sct_entries e
  where teamhub_is_active()
  group by e.event_code, e.season
  order by max(e.created_at) desc
$$;

create or replace function sct_delete_event(p_code text, p_season text) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not teamhub_is_admin() then raise exception 'Only admins can delete a past event''s data' using errcode = '42501'; end if;
  delete from sct_entries where upper(event_code) = upper(p_code) and season = p_season;
  get diagnostics n = row_count;
  delete from sct_picklist where upper(event_code) = upper(p_code);
  delete from sct_events where upper(code) = upper(p_code) and season = p_season;
  return n;
end $$;
