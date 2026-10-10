import { lazy } from 'react';
import { Link } from 'react-router';
import { UserCheck } from 'lucide-react';
import { Button, Card, CardHeader, buttonClass, formatTime } from '@teamhub/ui';
import { canWith, useMe, type IntegrationClient } from '@teamhub/sdk';
import { ATTENDABLE, useAttendable, useTakeForEvent, type EventLike } from './occurrences';

interface OccurrenceLike {
  date: string;
  start: Date;
}

/** "Take attendance" on a calendar event (any kind people attend: practices, meetings, competitions, outreach…). */
function EventAction({ event, occurrence }: { event: EventLike; occurrence: OccurrenceLike }) {
  const me = useMe();
  const take = useTakeForEvent();
  if (!(ATTENDABLE as readonly string[]).includes(event.kind) || !canWith(me, 'attendance.take', event.team_id)) return null;
  return (
    <Button size="sm" icon={<UserCheck className="size-4" />} onClick={() => take(event, occurrence.date, occurrence.start)}>
      Take attendance
    </Button>
  );
}

/** Today's calendar events that don't have attendance yet (Attendance widget + page): one tap to start. */
function TodayPractices() {
  const today = useAttendable(0);
  const take = useTakeForEvent();
  const list = today.data.filter((o) => !o.sessionId);
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {list.map((o) => (
        <Button key={`${o.event.id}:${o.date}`} size="sm" variant="primary" className="max-w-full" icon={<UserCheck className="size-4" />} onClick={() => take(o.event, o.date, o.start)}>
          <span className="min-w-0 truncate">
            Take attendance: {o.title}
            {o.allDay ? '' : ` · ${formatTime(o.start)}`}
          </span>
        </Button>
      ))}
    </div>
  );
}

/**
 * Home's "Attendance today" card with the Calendar tab: attendance still open today, plus today's practices and events
 * without attendance yet. Nothing today: no card.
 */
function TodayCard({ open }: { open: { id: string; title: string }[] }) {
  const today = useAttendable(0);
  const take = useTakeForEvent();
  if (today.isLoading) return null;
  const list = today.data.filter((o) => !o.sessionId);
  if (!open.length && !list.length) return null;
  return (
    <Card>
      <CardHeader icon={<UserCheck className="size-4" />} title="Attendance today" />
      <div className="space-y-2 px-4 pb-4">
        {open.map((s) => (
          <Link key={s.id} to={`/attendance/session/${s.id}`} className={buttonClass('primary', 'sm', 'w-full')}>
            <span className="min-w-0 truncate">Continue: {s.title}</span>
          </Link>
        ))}
        {list.map((o) => (
          <Button key={`${o.event.id}:${o.date}`} size="sm" variant="primary" className="w-full" icon={<UserCheck className="size-4" />} onClick={() => take(o.event, o.date, o.start)}>
            <span className="min-w-0 truncate">
              Take attendance: {o.title}
              {o.allDay ? '' : ` · ${formatTime(o.start)}`}
            </span>
          </Button>
        ))}
      </div>
    </Card>
  );
}

const client: IntegrationClient = {
  id: 'attendance+calendar',
  slots: {
    'calendar.event.actions': EventAction,
    'attendance.todayCard': TodayCard,
    'attendance.start': TodayPractices,
    // Replaces Attendance's own "start a practice" form: attendance is always for a calendar event.
    'attendance.picker': lazy(() => import('./picker')),
  },
};
export default client;
