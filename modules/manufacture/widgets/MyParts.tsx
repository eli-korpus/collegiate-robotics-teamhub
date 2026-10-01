import { Link } from 'react-router';
import { Box } from 'lucide-react';
import { Card, CardHeader, StatusPill } from '@teamhub/ui';
import { useMe } from '@teamhub/sdk';
import { STATUS, useJobs } from '../ui/Routes';

/** Requesters: "Your parts: 2 printing". */
export default function MyParts() {
  const me = useMe();
  const jobs = useJobs();
  const mine = (jobs.data ?? []).filter((j) => j.requested_by === me.id && ['submitted', 'queued', 'in_progress'].includes(j.status));
  if (!mine.length) return null;
  return (
    <Card>
      <CardHeader icon={<Box className="size-4" />} title="Your parts being made" />
      <ul className="space-y-1 px-2 pb-3">
        {mine.slice(0, 4).map((j) => (
          <li key={j.id}>
            <Link to={`/manufacture?item=${j.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-bg-subtle">
              <span className="min-w-0 flex-1 truncate">{j.title}</span>
              <StatusPill label={STATUS[j.status].label} tone={STATUS[j.status].tone} />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
