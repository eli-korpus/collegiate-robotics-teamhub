import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { UserCheck } from 'lucide-react';
import { Card, CardHeader, buttonClass, toDateInput } from '@teamhub/ui';
import { Slot, hasSlot, useSupabase } from '@teamhub/sdk';
import { sessionTitle, type Session } from '../data';

/**
 * Today strip for people who take attendance. Shows only when there's something to do today: an attendance session
 * that's still open, or (with the Calendar tab) today's practices and events without attendance yet. With nothing
 * scheduled there's no card; attendance can always be started from the Attendance tab.
 */
export default function TakeToday() {
  const sb = useSupabase();
  const q = useQuery({
    queryKey: ['attendance', 'today-all'],
    queryFn: async () => {
      const { data } = await sb.from('att_sessions').select('*').eq('date', toDateInput(new Date()));
      return (data ?? []) as Session[];
    },
  });
  if (q.isLoading) return null;
  const open = (q.data ?? []).filter((s) => !s.closed).map((s) => ({ id: s.id, title: sessionTitle(s) }));
  // With the Calendar tab, the card lists today's calendar events too (and decides whether to show at all).
  if (hasSlot('attendance.todayCard')) return <Slot name="attendance.todayCard" props={{ open }} />;
  if (!open.length) return null;
  return <TodayCard open={open} />;
}

function TodayCard({ open }: { open: { id: string; title: string }[] }) {
  return (
    <Card>
      <CardHeader icon={<UserCheck className="size-4" />} title="Attendance today" />
      <div className="space-y-2 px-4 pb-4">
        {open.map((s) => (
          <Link key={s.id} to={`/attendance/session/${s.id}`} className={buttonClass('primary', 'sm', 'w-full')}>
            Continue: {s.title}
          </Link>
        ))}
      </div>
    </Card>
  );
}
