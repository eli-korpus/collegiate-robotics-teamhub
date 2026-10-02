-- Nullable link from a practice session to the calendar event it was taken for (spec §4.4).
alter table att_sessions add column if not exists calendar_event_id uuid references cal_events (id) on delete set null;
alter table att_sessions add column if not exists occurrence_date date;
create index if not exists ix_attcal_sessions_event_idx on att_sessions (calendar_event_id);
