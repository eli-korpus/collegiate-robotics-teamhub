import { Link } from 'react-router';
import { Printer } from 'lucide-react';
import { Card, CardHeader } from '@teamhub/ui';
import { useMe } from '@teamhub/sdk';
import { canManage, useJobs, useMfgSettings } from '../ui/Routes';

/** Makers: "Queue: 4 jobs" per method they run. */
export default function QueueWidget({ teamId }: { teamId: string | null }) {
  const me = useMe();
  const jobs = useJobs();
  const settings = useMfgSettings();
  const open = (jobs.data ?? []).filter((j) => ['submitted', 'queued', 'in_progress'].includes(j.status) && canManage(me, j) && (!teamId || !j.team_id || j.team_id === teamId));
  if (!open.length) return null;
  const byMethod = settings.methods.map((m) => ({ m, n: open.filter((j) => j.method === m.id).length })).filter((x) => x.n);
  return (
    <Card>
      <CardHeader icon={<Printer className="size-4" />} title={`Your queue: ${open.length} job${open.length === 1 ? '' : 's'}`} action={<Link to="/manufacture" className="text-[12px] font-medium text-accent">Open</Link>} />
      <ul className="space-y-1 px-4 pb-4 text-[13px]">
        {byMethod.map(({ m, n }) => (
          <li key={m.id} className="flex justify-between">
            <span>{m.name}</span>
            <span className="tabular text-muted">{n}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
