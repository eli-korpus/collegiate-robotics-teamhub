import { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { cn } from './cn';

const DAY = 86_400_000;

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
/** Parses 'YYYY-MM-DD' as a local date (not UTC). */
export function parseDate(s: string | Date): Date {
  if (s instanceof Date) return s;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s);
}
export function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function toDateTimeInput(d: Date): string {
  return `${toDateInput(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY);
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(opts: Intl.DateTimeFormatOptions) {
  const k = JSON.stringify(opts);
  let f = fmtCache.get(k);
  if (!f) fmtCache.set(k, (f = new Intl.DateTimeFormat(undefined, opts)));
  return f;
}
export const formatDate = (d: Date | string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) =>
  fmt(opts).format(parseDate(d));
export const formatTime = (d: Date | string) => fmt({ hour: 'numeric', minute: '2-digit' }).format(new Date(d));
export const formatDateTime = (d: Date | string) =>
  fmt({ weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(d));

/** "today", "tomorrow", "in 3 days", "Mon, Oct 12" … */
export function relativeDay(d: Date | string, now = new Date()): string {
  const date = parseDate(d);
  const diff = daysBetween(now, date);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  if (diff > 1 && diff < 7) return fmt({ weekday: 'long' }).format(date);
  if (diff < 0 && diff > -7) return `${-diff} days ago`;
  return formatDate(date, { weekday: 'short', month: 'short', day: 'numeric', ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
}

export function relativeTime(d: Date | string, now = Date.now()): string {
  const t = new Date(d).getTime();
  const s = Math.round((now - t) / 1000);
  const abs = Math.abs(s);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (abs < 45) return 'just now';
  if (abs < 3600) return rtf.format(-Math.round(s / 60), 'minute');
  if (abs < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  if (abs < 86400 * 7) return rtf.format(-Math.round(s / 86400), 'day');
  return formatDate(new Date(t), { month: 'short', day: 'numeric', ...(new Date(t).getFullYear() !== new Date(now).getFullYear() ? { year: 'numeric' } : {}) });
}

/** Live-updating relative time (refreshes every minute). */
export function RelativeTime({ date, className }: { date: string | Date; className?: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  return (
    <time dateTime={new Date(date).toISOString()} title={new Date(date).toLocaleString()} className={cn('tabular', className)}>
      {relativeTime(date)}
    </time>
  );
}

/** One due-date look everywhere (spec P1): red when overdue, amber when today/tomorrow. */
export function DueDate({ date, done, className, icon = true }: { date: string | Date | null | undefined; done?: boolean; className?: string; icon?: boolean }) {
  if (!date) return null;
  const d = parseDate(date);
  const diff = daysBetween(new Date(), d);
  const tone = done ? 'text-faint' : diff < 0 ? 'text-danger' : diff <= 1 ? 'text-warning' : 'text-muted';
  return (
    <span className={cn('inline-flex items-center gap-1 text-[12.5px] whitespace-nowrap', tone, className)} title={d.toLocaleDateString()}>
      {icon && <CalendarClock className="size-3.5" />}
      {diff < 0 && !done ? `Overdue · ${relativeDay(d)}` : relativeDay(d)}
    </span>
  );
}

export type SmartBucket = 'overdue' | 'today' | 'week' | 'later' | 'none';
export function dueBucket(date: string | Date | null | undefined): SmartBucket {
  if (!date) return 'none';
  const diff = daysBetween(new Date(), parseDate(date));
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= 7) return 'week';
  return 'later';
}

/** Greetings by time of day. Each one reads as "<greeting>, Sam". */
const GREETINGS = {
  late: ['Working late', 'Still going', 'Up late', 'Night shift'],
  morning: ['Good morning', 'Morning', 'Rise and build', 'Fresh start today', 'Welcome back'],
  afternoon: ['Good afternoon', 'Welcome back', 'Hey there', 'Ready to build', 'Back at it'],
  evening: ['Good evening', 'Evening', 'Welcome back', 'Hey there', 'Nice to see you'],
};

/** Extra greetings for certain days of the week (0 = Sunday). */
const WEEKDAY_GREETINGS: Record<number, string[]> = {
  0: ['Happy Sunday'],
  1: ['Happy Monday', 'New week'],
  3: ['Halfway there'],
  5: ['Happy Friday'],
  6: ['Happy Saturday'],
};

/**
 * A friendly greeting for Home. It changes with the time of day and the date, but stays the same for a whole
 * morning, afternoon or evening so it doesn't flicker on every reload.
 */
export function greeting(d = new Date()): string {
  const h = d.getHours();
  const part = h < 5 ? 'late' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : h < 22 ? 'evening' : 'late';
  const pool = part === 'late' ? GREETINGS.late : [...GREETINGS[part], ...(WEEKDAY_GREETINGS[d.getDay()] ?? [])];
  const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
  const seed = (day * 31 + part.length * 7) % 9973;
  return pool[seed % pool.length]!;
}

