import { Link } from 'react-router';
import { Clock } from 'lucide-react';
import { Card, CardHeader } from '@teamhub/ui';
import { canWith, useMe, useSeason } from '@teamhub/sdk';
import { useHours, useOutEvents } from './data';

export default function HoursToApprove({ teamId }: { teamId: string | null }) {
  const me = useMe();
  const season = useSeason();
  const events = useOutEvents(season);
  const hours = useHours();
  const mine = (events.data ?? []).filter((e) => (!teamId || !e.team_id || e.team_id === teamId) && canWith(me, 'outreach.approve_hours', e.team_id));
  const waiting = mine.map((e) => ({ e, n: (hours.data ?? []).filter((h) => h.event_id === e.id && !h.approved).length })).filter((x) => x.n > 0);
  if (!waiting.length) return null;
  return (
    <Card>
      <CardHeader icon={<Clock className="size-4" />} title="Outreach hours to approve" />
      <ul className="space-y-1 px-2 pb-3 text-[13px]">
        {waiting.slice(0, 4).map(({ e, n }) => (
          <li key={e.id}>
            <Link to={`/outreach?item=${e.id}`} className="flex rounded-md px-2 py-1.5 hover:bg-bg-subtle">
              <span className="flex-1 truncate">{e.title}</span>
              <span className="text-warning">{n}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
