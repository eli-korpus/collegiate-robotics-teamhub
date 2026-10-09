-- A multi-day event's end date is now its last day (Oct 21 to Oct 30 shows on the 30th). Before, the calendar left
-- the end date off, so people entered the day after (Oct 31). Move those end dates back one day; an event that then
-- ends on its start day becomes a one-day event. Competitions with an event code are left as they are: their dates
-- usually came from FTCScout, which already gives the real last day.
update cal_events
set ends_at = case when ends_at - interval '1 day' > starts_at then ends_at - interval '1 day' end
where all_day
  and ends_at > starts_at
  and not (kind = 'competition' and event_code is not null);
