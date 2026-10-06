import { useNavigate } from 'react-router';
import { CalendarPlus, CheckCircle2, UserCheck } from 'lucide-react';
import { Button, Dialog, EmptyState, Spinner, formatDate, formatTime, toDateInput } from '@teamhub/ui';
import { TeamBadge, isMultiTeam } from '@teamhub/sdk';
import { KIND_LABEL, useAttendable, useTakeForEvent, type EventOccurrence } from './occurrences';

/**
 * "Take attendance" in the Attendance tab when the Calendar is on: pick the practice or event from the calendar
 * instead of typing a separate one.
 */
export default function PickEventDialog({ onClose }: { onClose: () => void }) {
  const list = useAttendable(6);
  const take = useTakeForEvent();
  const nav = useNavigate();
  const today = toDateInput(new Date());
  const todays = list.data.filter((o) => o.date === today);
  const earlier = list.data.filter((o) => o.date < today).reverse();
  const row = (o: EventOccurrence) => (
    <li key={`${o.event.id}:${o.date}`} className="flex items-center gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium">{o.title}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
          {KIND_LABEL[o.event.kind] ?? 'Event'} · {o.date === today ? 'Today' : formatDate(o.start, { weekday: 'short', month: 'short', day: 'numeric' })}
          {!o.allDay && ` · ${formatTime(o.start)}`}
          {isMultiTeam() && <TeamBadge teamId={o.event.team_id} />}
        </p>
      </div>
      {o.sessionId ? (
        <Button size="sm" icon={<CheckCircle2 className="size-4" />} onClick={() => take(o.event, o.date, o.start)}>
          Open
        </Button>
      ) : (
        <Button size="sm" variant="primary" icon={<UserCheck className="size-4" />} onClick={() => take(o.event, o.date, o.start)}>
          Take attendance
        </Button>
      )}
    </li>
  );
  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      title="Take attendance"
      description="Pick the practice or event from the calendar. Attendance is saved with it."
      size="md"
      footer={
        <Button icon={<CalendarPlus className="size-4" />} onClick={() => nav(`/calendar?new=1&kind=practice&date=${today}`)}>
          Not on the calendar? Add it
        </Button>
      }
    >
      {list.isLoading ? (
        <Spinner />
      ) : !list.data.length ? (
        <EmptyState icon={<CalendarPlus />} title="Nothing on the calendar this week" body="Add the practice to the calendar first, then take attendance for it." />
      ) : (
        <div className="space-y-4">
          {todays.length > 0 && (
            <section>
              <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-faint">Today</p>
              <ul className="divide-y divide-border rounded-md border border-border">{todays.map(row)}</ul>
            </section>
          )}
          {earlier.length > 0 && (
            <section>
              <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-faint">Earlier this week</p>
              <ul className="divide-y divide-border rounded-md border border-border">{earlier.map(row)}</ul>
            </section>
          )}
        </div>
      )}
    </Dialog>
  );
}
