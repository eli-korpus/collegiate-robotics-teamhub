import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Play, UserCheck } from 'lucide-react';
import { Button, Card, CardHeader, buttonClass, toDateInput } from '@teamhub/ui';
import { Slot, hasSlot, useSupabase } from '@teamhub/sdk';
import { sessionTitle, type Session } from '../data';
import { StartDialog } from '../ui/Routes';

/** Today strip: "Practice today: take attendance" for takers. */
export default function TakeToday() {
  const sb = useSupabase();
  const [starting, setStarting] = useState(false);
  const fromCalendar = hasSlot('attendance.picker');
  const q = useQuery({
    queryKey: ['attendance', 'today-all'],
    queryFn: async () => {
      const { data } = await sb.from('att_sessions').select('*').eq('date', toDateInput(new Date()));
      return (data ?? []) as Session[];
    },
  });
  const open = (q.data ?? []).filter((s) => !s.closed);
  return (
    <Card>
      <CardHeader icon={<UserCheck className="size-4" />} title="Practice today" />
      <div className="space-y-2 px-4 pb-4">
        {open.map((s) => (
          <Link key={s.id} to={`/attendance/session/${s.id}`} className={buttonClass('primary', 'sm', 'w-full')}>
            Continue: {sessionTitle(s)}
          </Link>
        ))}
        <Slot name="attendance.today" props={{ sessions: q.data ?? [] }} />
        {!open.length && (
          <Button size="sm" icon={<Play className="size-4" />} onClick={() => setStarting(true)}>
            Start taking attendance
          </Button>
        )}
      </div>
      {starting && (fromCalendar ? <Slot name="attendance.picker" props={{ onClose: () => setStarting(false) }} /> : <StartDialog onClose={() => setStarting(false)} />)}
    </Card>
  );
}
