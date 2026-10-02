import { useRows } from '@teamhub/sdk';

export interface OutEvent {
  id: string;
  team_id: string | null;
  title: string;
  date: string;
  starts_at: string | null;
  ends_at: string | null;
  kind: string;
  location: string | null;
  people_reached: number | null;
  description: string | null;
  season: string;
  created_by: string | null;
}
export interface Hours {
  event_id: string;
  user_id: string;
  hours: number;
  approved: boolean;
  approved_by: string | null;
}

export const useOutEvents = (season: string) =>
  useRows<OutEvent>(['outreach', 'events', season], (sb) => sb.from('out_events').select('*').eq('season', season).order('date', { ascending: false }));
/** All hours rows (tiny table); callers filter by the season's event ids. */
export const useHours = () => useRows<Hours>(['outreach', 'hours'], (sb) => sb.from('out_hours').select('event_id, user_id, hours, approved, approved_by'));

export interface Totals {
  hours: number;
  pending: number;
  people: number;
  events: number;
  byKind: Map<string, { hours: number; people: number; events: number }>;
  byPerson: Map<string, number>;
}

/** Season totals. Only approved hours count toward "hours"; unapproved are reported as pending. */
export function totals(events: OutEvent[], hours: Hours[]): Totals {
  const ids = new Set(events.map((e) => e.id));
  const kindOf = new Map(events.map((e) => [e.id, e.kind]));
  const byKind = new Map<string, { hours: number; people: number; events: number }>();
  for (const e of events) {
    const k = byKind.get(e.kind) ?? { hours: 0, people: 0, events: 0 };
    k.events++;
    k.people += e.people_reached ?? 0;
    byKind.set(e.kind, k);
  }
  const byPerson = new Map<string, number>();
  let sum = 0;
  let pending = 0;
  for (const h of hours) {
    if (!ids.has(h.event_id)) continue;
    const hrs = Number(h.hours);
    if (!h.approved) {
      pending += hrs;
      continue;
    }
    sum += hrs;
    byPerson.set(h.user_id, (byPerson.get(h.user_id) ?? 0) + hrs);
    byKind.get(kindOf.get(h.event_id)!)!.hours += hrs;
  }
  return { hours: round(sum), pending: round(pending), people: events.reduce((n, e) => n + (e.people_reached ?? 0), 0), events: events.length, byKind, byPerson };
}
export const round = (n: number) => Math.round(n * 10) / 10;
