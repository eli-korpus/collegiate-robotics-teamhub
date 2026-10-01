import { Link } from 'react-router';
import { CalendarDays } from 'lucide-react';
import { Card, CardHeader, addDays, formatDate, formatTime, relativeDay } from '@teamhub/ui';
import { KINDS } from '../kinds';
import { startOfToday, useCalendarData } from '../data';

/** Home widget: next 3 events (own events + overlays). */
export default function UpNext({ teamId }: { teamId: string | null }) {
  const from = startOfToday();
  const data = useCalendarData(from, addDays(from, 30), teamId);
  const now = Date.now();
  const items = [
    ...data.occurrences.filter((o) => !o.cancelled && (o.end ?? o.start).getTime() >= now).map((o) => ({ key: o.key, title: o.title, start: o.start, allDay: o.event.all_day, color: KINDS[o.event.kind].color, href: `/calendar?event=${encodeURIComponent(o.key)}` })),
    ...data.overlays.filter((o) => (o.end ?? o.start).getTime() >= now).map((o) => ({ key: o.id, title: o.title, start: o.start, allDay: !!o.allDay, color: o.color ?? 'var(--accent)', href: o.href })),
  ]
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, 3);
  return (
    <Card>
      <CardHeader icon={<CalendarDays className="size-4" />} title="Up next" action={<Link to="/calendar" className="text-[12px] font-medium text-accent">Calendar</Link>} />
      {items.length ? (
        <ul className="space-y-1 px-2 pb-3">
          {items.map((i) => (
            <li key={i.key}>
              <Link to={i.href} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-bg-subtle">
                <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: i.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{i.title}</span>
                  <span className="block text-[12px] capitalize text-muted">
                    {relativeDay(i.start)}
                    {!i.allDay && ` · ${formatTime(i.start)}`}
                  </span>
                </span>
                <span className="tabular text-[11.5px] text-faint">{formatDate(i.start)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 pb-4 text-[12.5px] text-faint">{data.isLoading ? 'Loading…' : 'Nothing in the next 30 days.'}</p>
      )}
    </Card>
  );
}
