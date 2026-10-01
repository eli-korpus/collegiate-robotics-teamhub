import { Link } from 'react-router';
import { UserCheck } from 'lucide-react';
import { Card, CardHeader, ProgressRing } from '@teamhub/ui';
import { useMe, usePeople } from '@teamhub/sdk';
import { statsFor, useAttSettings, usePresence, useSeasonSessions } from '../data';

export default function MyAttendance() {
  const me = useMe();
  const people = usePeople();
  const sessions = useSeasonSessions();
  const presence = usePresence(sessions.data?.map((s) => s.id), me.id);
  const settings = useAttSettings();
  const p = people.data?.get(me.id);
  if (!p || !sessions.data || !presence.data) return null;
  const st = statsFor(p, sessions.data, presence.data, settings.includeMentors);
  if (!st.expected) return null;
  return (
    <Card>
      <CardHeader icon={<UserCheck className="size-4" />} title="Your attendance" action={<Link to="/attendance" className="text-[12px] font-medium text-accent">Details</Link>} />
      <div className="flex items-center gap-4 px-4 pb-4">
        <ProgressRing value={st.pct ?? 0} size={60}>
          {st.pct == null ? '—' : `${Math.round(st.pct * 100)}%`}
        </ProgressRing>
        <p className="text-[13px] text-muted">
          {st.attended} of {st.expected} practices this season
        </p>
      </div>
    </Card>
  );
}
