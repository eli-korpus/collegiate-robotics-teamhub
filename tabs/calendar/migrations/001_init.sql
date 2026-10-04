-- Calendar (spec §13.2). Recurring events are one row with an RRULE; occurrences are expanded client-side.
create table cal_events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  kind text not null default 'other' check (kind in ('practice', 'meeting', 'competition', 'outreach', 'deadline', 'social', 'other')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  location text check (char_length(location) <= 200),
  notes text check (char_length(notes) <= 2000),
  recurrence text check (char_length(recurrence) <= 200),
  event_code text check (char_length(event_code) <= 20),
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index cal_events_starts_idx on cal_events (starts_at);

-- Per-occurrence changes to a recurring event: cancel one date or override its time/title.
create table cal_exceptions (
  event_id uuid not null references cal_events (id) on delete cascade,
  occurrence_date date not null,
  cancelled boolean not null default false,
  override jsonb,
  primary key (event_id, occurrence_date)
);

-- Secret iCal feed tokens (one for the program, optionally one per team). Admin-only.
create table cal_feeds (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams (id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
);
create unique index cal_feeds_team_idx on cal_feeds (coalesce(team_id, '00000000-0000-0000-0000-000000000000'::uuid));

create or replace function cal_ics_escape(t text) returns text
language sql immutable as $$
  select replace(replace(replace(replace(coalesce(t, ''), '\', '\\'), ';', '\;'), ',', '\,'), E'\n', '\n')
$$;

create or replace function cal_ics_time(t timestamptz) returns text
language sql immutable as $$ select to_char(t at time zone 'UTC', 'YYYYMMDD"T"HH24MISS"Z"') $$;

-- Builds the .ics text for a feed token (called by the `ical` edge function with the service role).
create or replace function cal_ical(p_token text) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  f cal_feeds;
  e record;
  x record;
  out text;
  prog text := 'TeamHub';
begin
  select * into f from cal_feeds where token = p_token;
  if not found then return null; end if;
  out := E'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//TeamHub FTC//Calendar//EN\r\nCALSCALE:GREGORIAN\r\nX-WR-CALNAME:'
    || cal_ics_escape(coalesce((select name from teams where id = f.team_id), prog)) || E'\r\n';
  for e in
    select * from cal_events
    where (f.team_id is null or team_id is null or team_id = f.team_id)
      and (recurrence is not null or coalesce(ends_at, starts_at) > now() - interval '120 days')
  loop
    out := out || E'BEGIN:VEVENT\r\nUID:' || e.id || E'@teamhub\r\nDTSTAMP:' || cal_ics_time(e.created_at) || E'\r\n';
    if e.all_day then
      out := out || 'DTSTART;VALUE=DATE:' || to_char(e.starts_at, 'YYYYMMDD') || E'\r\n'
        || 'DTEND;VALUE=DATE:' || to_char(coalesce(e.ends_at, e.starts_at) + interval '1 day', 'YYYYMMDD') || E'\r\n';
    else
      out := out || 'DTSTART:' || cal_ics_time(e.starts_at) || E'\r\n'
        || 'DTEND:' || cal_ics_time(coalesce(e.ends_at, e.starts_at + interval '1 hour')) || E'\r\n';
    end if;
    out := out || 'SUMMARY:' || cal_ics_escape(e.title) || E'\r\n';
    if e.location is not null then out := out || 'LOCATION:' || cal_ics_escape(e.location) || E'\r\n'; end if;
    if e.notes is not null then out := out || 'DESCRIPTION:' || cal_ics_escape(e.notes) || E'\r\n'; end if;
    if e.recurrence is not null then
      out := out || 'RRULE:' || regexp_replace(e.recurrence, '^RRULE:', '') || E'\r\n';
      for x in select * from cal_exceptions where event_id = e.id and cancelled loop
        out := out || (case when e.all_day then 'EXDATE;VALUE=DATE:' || to_char(x.occurrence_date, 'YYYYMMDD')
                       else 'EXDATE:' || cal_ics_time((x.occurrence_date + (e.starts_at at time zone 'UTC')::time) at time zone 'UTC') end) || E'\r\n';
      end loop;
    end if;
    out := out || E'END:VEVENT\r\n';
  end loop;
  return out || E'END:VCALENDAR\r\n';
end $$;
revoke execute on function cal_ical(text) from public, anon, authenticated;
