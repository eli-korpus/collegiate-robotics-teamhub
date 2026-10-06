import { lazy } from 'react';
import { UserCheck } from 'lucide-react';
import { Button, formatTime } from '@teamhub/ui';
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
        <Button key={`${o.event.id}:${o.date}`} size="sm" variant="primary" icon={<UserCheck className="size-4" />} onClick={() => take(o.event, o.date, o.start)}>
          Take attendance: {o.title}
          {o.allDay ? '' : ` · ${formatTime(o.start)}`}
        </Button>
      ))}
    </div>
  );
}

const client: IntegrationClient = {
  id: 'attendance+calendar',
  slots: {
    'calendar.event.actions': EventAction,
    'attendance.today': TodayPractices,
    'attendance.start': TodayPractices,
    // Replaces Attendance's own "start a practice" form: attendance is always for a calendar event.
    'attendance.picker': lazy(() => import('./picker')),
  },
};
export default client;
