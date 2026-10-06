/**
 * Small RRULE subset (RFC 5545): enough for team schedules, expanded client-side (spec §13.2):
 * FREQ=DAILY|WEEKLY|MONTHLY, INTERVAL, BYDAY (weekly), UNTIL (date or UTC datetime), COUNT.
 */
export const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface Rule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  interval: number;
  byDay: Weekday[];
  until: Date | null;
  count: number | null;
}

export function parseRule(s: string | null | undefined): Rule | null {
  if (!s) return null;
  const parts: Record<string, string> = Object.fromEntries(
    s
      .replace(/^RRULE:/, '')
      .split(';')
      .map((p) => p.split('=') as [string, string]),
  );
  if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(parts.FREQ)) return null;
  let until: Date | null = null;
  if (parts.UNTIL) {
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(parts.UNTIL);
    if (m) until = m[4] ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59);
  }
  return {
    freq: parts.FREQ as Rule['freq'],
    interval: Math.max(1, Number(parts.INTERVAL ?? 1) || 1),
    byDay: (parts.BYDAY ? parts.BYDAY.split(',') : []).filter((d: string) => (WEEKDAYS as readonly string[]).includes(d)) as Weekday[],
    until,
    count: parts.COUNT ? Math.max(1, Number(parts.COUNT)) : null,
  };
}

export function formatRule(r: Rule): string {
  const p = [`FREQ=${r.freq}`];
  if (r.interval > 1) p.push(`INTERVAL=${r.interval}`);
  if (r.freq === 'WEEKLY' && r.byDay.length) p.push(`BYDAY=${r.byDay.join(',')}`);
  if (r.until) {
    const u = r.until;
    p.push(`UNTIL=${u.getFullYear()}${String(u.getMonth() + 1).padStart(2, '0')}${String(u.getDate()).padStart(2, '0')}`);
  } else if (r.count) p.push(`COUNT=${r.count}`);
  return p.join(';');
}

/** Occurrence start times of a recurring event that fall in [from, to). Max 500 to stay safe. */
export function expand(start: Date, rule: Rule, from: Date, to: Date): Date[] {
  const out: Date[] = [];
  let n = 0;
  const push = (d: Date) => {
    n++;
    if (rule.count && n > rule.count) return false;
    if (rule.until && d > rule.until) return false;
    if (d >= from && d < to) out.push(d);
    return d < to && out.length < 500;
  };
  const at = (base: Date, days: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d;
  };
  if (rule.freq === 'DAILY') {
    for (let i = 0; i < 5000; i++) if (!push(at(start, i * rule.interval))) break;
  } else if (rule.freq === 'WEEKLY') {
    const days = rule.byDay.length ? rule.byDay.map((d) => WEEKDAYS.indexOf(d)).sort() : [start.getDay()];
    const weekStart = at(start, -start.getDay());
    outer: for (let w = 0; w < 2000; w++) {
      for (const dow of days) {
        const d = at(weekStart, w * 7 * rule.interval + dow);
        if (d < start) continue;
        if (!push(d)) break outer;
      }
    }
  } else {
    for (let i = 0; i < 600; i++) {
      const d = new Date(start);
      d.setMonth(start.getMonth() + i * rule.interval);
      if (d.getDate() !== start.getDate()) continue; // skip months without that day (e.g. the 31st)
      if (!push(d)) break;
    }
  }
  return out;
}

const DAY_NAMES: Record<Weekday, string> = { SU: 'Sun', MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat' };
export function describeRule(r: Rule | null): string {
  if (!r) return 'Does not repeat';
  const every = r.interval > 1 ? `Every ${r.interval} ${r.freq === 'DAILY' ? 'days' : r.freq === 'WEEKLY' ? 'weeks' : 'months'}` : r.freq === 'DAILY' ? 'Daily' : r.freq === 'WEEKLY' ? 'Weekly' : 'Monthly';
  const on = r.freq === 'WEEKLY' && r.byDay.length ? ` on ${r.byDay.map((d) => DAY_NAMES[d]).join(', ')}` : '';
  const end = r.until ? ` until ${r.until.toLocaleDateString()}` : r.count ? `, ${r.count} times` : '';
  return every + on + end;
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
