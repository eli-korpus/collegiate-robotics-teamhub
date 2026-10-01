import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserCheck } from 'lucide-react';
import { Button, addDays, formatTime, startOfDay, toDateInput, toast } from '@teamhub/ui';
import { canWith, friendlyError, useMe, useSupabase, type IntegrationClient } from '@teamhub/sdk';

interface EventLike {
  id: string;
  title: string;
  kind: string;
  team_id: string | null;
}
interface OccurrenceLike {
  date: string;
  start: Date;
}

/** Find or create the attendance session for a calendar occurrence, then open it. */
function useTakeForEvent() {
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

function EventAction({ event, occurrence }: { event: EventLike; occurrence: OccurrenceLike }) {
  const me = useMe();
  const take = useTakeForEvent();
  if (!['practice', 'meeting'].includes(event.kind) || !canWith(me, 'attendance.take', event.team_id)) return null;
  return (
    <Button size="sm" icon={<UserCheck className="size-4" />} onClick={() => take(event, occurrence.date, occurrence.start)}>
      Take attendance
    </Button>
  );
}

/** Today's practices from the calendar that don't have a session yet (Attendance widget + page). */
function TodayPractices() {
  const sb = useSupabase();
  const me = useMe();
  const take = useTakeForEvent();
  const today = startOfDay(new Date());
  const q = useQuery({
    queryKey: ['calendar', 'today-practices', toDateInput(today)],
    queryFn: async () => {
      // Non-recurring practices today + recurring practices (expanded roughly: weekly rules by weekday).
      const { data } = await sb
        .from('cal_events')
        .select('id, title, kind, team_id, starts_at, recurrence')
        .in('kind', ['practice', 'meeting'])
        .or(`recurrence.not.is.null,and(starts_at.gte.${today.toISOString()},starts_at.lt.${addDays(today, 1).toISOString()})`);
      const dow = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][today.getDay()];
      return (data ?? []).filter((e: any) => {
        const s = new Date(e.starts_at);
        if (!e.recurrence) return true;
        if (s > addDays(today, 1)) return false;
        const by = /BYDAY=([A-Z,]+)/.exec(e.recurrence)?.[1]?.split(',') ?? [['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][s.getDay()]];
        return /FREQ=DAILY/.test(e.recurrence) || (/FREQ=WEEKLY/.test(e.recurrence) && by.includes(dow));
      }) as (EventLike & { starts_at: string })[];
    },
  });
  const sessions = useQuery({
    queryKey: ['attendance', 'today-linked', toDateInput(today)],
    queryFn: async () => {
      const { data } = await sb.from('att_sessions').select('calendar_event_id').eq('date', toDateInput(today)).not('calendar_event_id', 'is', null);
      return (data ?? []) as { calendar_event_id: string }[];
    },
  });
  const taken = new Set((sessions.data ?? []).map((s) => s.calendar_event_id));
  const list = (q.data ?? []).filter((e) => !taken.has(e.id) && canWith(me, 'attendance.take', e.team_id));
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {list.map((e) => {
        const s = new Date(e.starts_at);
        const start = new Date(today);
        start.setHours(s.getHours(), s.getMinutes());
        return (
          <Button key={e.id} size="sm" variant="primary" icon={<UserCheck className="size-4" />} onClick={() => take(e, toDateInput(today), start)}>
            Take attendance: {e.title} · {formatTime(start)}
          </Button>
        );
      })}
    </div>
  );
}

const client: IntegrationClient = {
  id: 'attendance+calendar',
  slots: {
    'calendar.event.actions': EventAction,
    'attendance.today': TodayPractices,
    'attendance.start': TodayPractices,
  },
};
export default client;
