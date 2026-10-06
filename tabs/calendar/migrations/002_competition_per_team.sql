-- A competition on the calendar is for one team, and each team has it once (two teams at the same event = two
-- calendar events), so the Events and Competition Day pages can link to it. Additions only.
do $$ begin
  if not exists (
    select 1 from cal_events where kind = 'competition' and event_code is not null
    group by team_id, upper(event_code) having count(*) > 1
  ) then
    create unique index if not exists cal_events_competition_once_per_team
      on cal_events (team_id, upper(event_code)) where kind = 'competition' and event_code is not null;
  end if;
end $$;
