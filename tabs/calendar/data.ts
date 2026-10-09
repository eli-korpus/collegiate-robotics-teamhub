import { useQuery } from '@tanstack/react-query';
import { calendarOverlays, useSupabase, type CalendarOverlayItem, type Sb } from '@teamhub/sdk';
import { addDays, startOfDay } from '@teamhub/ui';
import { dateKey, expand, parseRule } from './rrule';
import type { Kind } from './kinds';

export interface CalEvent {
  id: string;
  team_id: string | null;
  title: string;
  kind: Kind;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  notes: string | null;
  recurrence: string | null;
  event_code: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CalException {
  event_id: string;
  occurrence_date: string;
  cancelled: boolean;
  override: { title?: string; starts_at?: string; ends_at?: string; location?: string } | null;
}

export interface Occurrence {
  key: string;
  event: CalEvent;
  date: string; // local YYYY-MM-DD of this occurrence
  start: Date;
  end: Date | null;
  title: string;
  location: string | null;
  cancelled: boolean;
  recurring: boolean;
}

/** All-day events are stored at 12:00 UTC so the date is the same in every timezone and in iCal. */
export function allDayToDate(iso: string): Date {
  const d = new Date(iso);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
export function dateToAllDay(localDate: string): string {
  return `${localDate}T12:00:00.000Z`;
}

export async function fetchEvents(sb: Sb, from: Date, to: Date): Promise<{ events: CalEvent[]; exceptions: CalException[] }> {
  const lookback = addDays(from, -31).toISOString();
  const { data, error } = await sb
    .from('cal_events')
    .select('*')
    .or(`recurrence.not.is.null,and(starts_at.gte.${lookback},starts_at.lt.${to.toISOString()})`)
    .order('starts_at');
  if (error) throw error;
  const events = (data ?? []) as CalEvent[];
  const recurring = events.filter((e) => e.recurrence).map((e) => e.id);
  let exceptions: CalException[] = [];
  if (recurring.length) {
    const ex = await sb.from('cal_exceptions').select('*').in('event_id', recurring);
    if (ex.error) throw ex.error;
    exceptions = ex.data as CalException[];
  }
  return { events, exceptions };
}

export function expandOccurrences(events: CalEvent[], exceptions: CalException[], from: Date, to: Date): Occurrence[] {
  const exMap = new Map(exceptions.map((x) => [`${x.event_id}:${x.occurrence_date}`, x]));
  const out: Occurrence[] = [];
  for (const e of events) {
    const start = e.all_day ? allDayToDate(e.starts_at) : new Date(e.starts_at);
    const end = e.ends_at ? (e.all_day ? allDayToDate(e.ends_at) : new Date(e.ends_at)) : null;
    const duration = end ? end.getTime() - start.getTime() : 0;
    const rule = parseRule(e.recurrence);
    const starts = rule ? expand(start, rule, addDays(from, -1), to) : [start];
    for (const s of starts) {
      const occEnd = end ? new Date(s.getTime() + duration) : null;
      if ((occEnd ?? s) < from || s >= to) continue;
      const date = dateKey(s);
      const ex = rule ? exMap.get(`${e.id}:${date}`) : undefined;
      const o = ex?.override;
      out.push({
        key: `${e.id}:${date}`,
        event: e,
        date,
        start: o?.starts_at ? new Date(o.starts_at) : s,
        end: o?.ends_at ? new Date(o.ends_at) : occEnd,
        title: o?.title ?? e.title,
        location: o?.location ?? e.location,
        cancelled: !!ex?.cancelled,
        recurring: !!rule,
      });
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Events + overlays from other tabs (outreach, FTCScout competitions, task due dates …) for a range. */
export function useCalendarData(from: Date, to: Date, teamId: string | null) {
  const sb = useSupabase();
  const events = useQuery({
    queryKey: ['calendar', 'events', from.toISOString(), to.toISOString()],
    queryFn: () => fetchEvents(sb, from, to),
  });
  const overlays = useQuery({
    queryKey: ['calendar', 'overlays', from.toISOString(), to.toISOString()],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const all = await Promise.all(calendarOverlays().map((o) => o(sb, { from, to }).catch(() => [] as CalendarOverlayItem[])));
      return all.flat();
    },
  });
  const inScope = (t: string | null | undefined) => !teamId || !t || t === teamId;
  const occurrences = events.data ? expandOccurrences(events.data.events.filter((e) => inScope(e.team_id)), events.data.exceptions, from, to) : [];
  // A calendar competition with an event code replaces that team's FTCScout entry (the calendar one keeps travel
  // notes). A competition without a team (one-team programs) replaces it for every team.
  const manual = occurrences.filter((o) => o.event.kind === 'competition' && o.event.event_code);
  const replaced = (code: string, team: string | null | undefined) =>
    manual.some((o) => o.event.event_code!.toUpperCase() === code.toUpperCase() && (!o.event.team_id || o.event.team_id === team));
  const overlayItems = (overlays.data ?? []).filter((o) => inScope(o.teamId) && !(o.eventCode && replaced(o.eventCode, o.teamId)));
  return { occurrences, overlays: overlayItems, isLoading: events.isLoading, error: events.error, refetch: events.refetch };
}

export function startOfToday(): Date {
  return startOfDay(new Date());
}
