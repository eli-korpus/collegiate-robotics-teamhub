import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, startOfDay, toDateInput, toast } from '@teamhub/ui';
import { canWith, friendlyError, useMe, useSupabase, type Sb } from '@teamhub/sdk';
import { dateKey, expand, parseRule } from '@teamhub/sdk/rrule';

/** Kinds of calendar events people attend (deadlines aren't attended). */
export const ATTENDABLE = ['practice', 'meeting', 'competition', 'outreach', 'social', 'other'] as const;
export const KIND_LABEL: Record<string, string> = { practice: 'Practice', meeting: 'Meeting', competition: 'Competition', outreach: 'Outreach', social: 'Social', other: 'Event' };

export interface EventLike {
  id: string;
  title: string;
  kind: string;
  team_id: string | null;
}
export interface EventRow extends EventLike {
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  recurrence: string | null;
}
export interface ExceptionRow {
  event_id: string;
  occurrence_date: string;
  cancelled: boolean;
  override: { title?: string; starts_at?: string } | null;
}
export interface EventOccurrence {
  event: EventLike;
  date: string;
  start: Date;
  title: string;
  allDay: boolean;
  /** The attendance session already taken for it, if any. */
  sessionId: string | null;
}

const allDayDate = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** The occurrences of these events between two dates: repeats expanded, cancelled dates and deadlines left out. */
export function expandAttendable(events: EventRow[], exceptions: ExceptionRow[], from: Date, to: Date): EventOccurrence[] {
  const exMap = new Map(exceptions.map((x) => [`${x.event_id}:${x.occurrence_date}`, x]));
  const out: EventOccurrence[] = [];
  for (const e of events) {
    if (!(ATTENDABLE as readonly string[]).includes(e.kind)) continue;
    const start = e.all_day ? allDayDate(e.starts_at) : new Date(e.starts_at);
    const rule = parseRule(e.recurrence);
    for (const s of rule ? expand(start, rule, addDays(from, -1), to) : [start]) {
      if (s < from || s >= to) continue;
      const date = dateKey(s);
      const x = rule ? exMap.get(`${e.id}:${date}`) : undefined;
      if (x?.cancelled) continue;
      out.push({
        event: { id: e.id, title: e.title, kind: e.kind, team_id: e.team_id },
        date,
        start: x?.override?.starts_at ? new Date(x.override.starts_at) : s,
        title: x?.override?.title ?? e.title,
        allDay: e.all_day,
        sessionId: null,
      });
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Calendar occurrences people can take attendance for between two dates (repeats expanded, cancelled ones left out). */
export async function fetchAttendable(sb: Sb, from: Date, to: Date): Promise<EventOccurrence[]> {
  const ev = await sb
    .from('cal_events')
    .select('id, title, kind, team_id, starts_at, ends_at, all_day, recurrence')
    .in('kind', [...ATTENDABLE])
    .or(`recurrence.not.is.null,and(starts_at.gte.${from.toISOString()},starts_at.lt.${to.toISOString()})`);
  if (ev.error) throw ev.error;
  const events = (ev.data ?? []) as EventRow[];
  const recurring = events.filter((e) => e.recurrence).map((e) => e.id);
  const ex = recurring.length ? await sb.from('cal_exceptions').select('event_id, occurrence_date, cancelled, override').in('event_id', recurring) : { data: [], error: null };
  if (ex.error) throw ex.error;
  const out = expandAttendable(events, (ex.data ?? []) as ExceptionRow[], from, to);
  if (out.length) {
    const ss = await sb
      .from('att_sessions')
      .select('id, calendar_event_id, occurrence_date')
      .in('calendar_event_id', [...new Set(out.map((o) => o.event.id))]);
    const byKey = new Map(((ss.data ?? []) as { id: string; calendar_event_id: string; occurrence_date: string }[]).map((s) => [`${s.calendar_event_id}:${s.occurrence_date}`, s.id]));
    for (const o of out) o.sessionId = byKey.get(`${o.event.id}:${o.date}`) ?? null;
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Occurrences from `daysBack` days ago through today that the viewer can take attendance for. */
export function useAttendable(daysBack: number) {
  const sb = useSupabase();
  const me = useMe();
  const today = startOfDay(new Date());
  const q = useQuery({
    queryKey: ['attendance', 'calendar-occurrences', toDateInput(today), daysBack],
    queryFn: () => fetchAttendable(sb, addDays(today, -daysBack), addDays(today, 1)),
  });
  return { ...q, data: (q.data ?? []).filter((o) => canWith(me, 'attendance.take', o.event.team_id)) };
}

/** Open the attendance session for a calendar occurrence, creating it the first time. */
export function useTakeForEvent() {
  const sb = useSupabase();
  const me = useMe();
  const nav = useNavigate();
  const qc = useQueryClient();
  return async (e: EventLike, date: string, start: Date | null) => {
    const existing = await sb.from('att_sessions').select('id').eq('calendar_event_id', e.id).eq('occurrence_date', date).maybeSingle();
    if (existing.data) return nav(`/attendance/session/${existing.data.id}`);
    const { data, error } = await sb
      .from('att_sessions')
      .insert({ title: e.title, date, team_id: e.team_id, calendar_event_id: e.id, occurrence_date: date, starts_at: start?.toISOString() ?? null, created_by: me.id })
      .select('id')
      .single();
    if (error) return toast.error(friendlyError(error));
    qc.invalidateQueries({ queryKey: ['attendance'] });
    nav(`/attendance/session/${data.id}`);
  };
}
