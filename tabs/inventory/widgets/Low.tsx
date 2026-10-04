import { Link } from 'react-router';
import { PackageX } from 'lucide-react';
import { Card, CardHeader } from '@teamhub/ui';
import { isLow, useParts } from '../ui/Routes';

/** "5 items low". */
export default function LowStock({ teamId }: { teamId: string | null }) {
  const parts = useParts();
  const low = (parts.data ?? []).filter((p) => isLow(p) && (!teamId || !p.team_id || p.team_id === teamId));
  if (!low.length) return null;
  return (
    <Card>
      <CardHeader icon={<PackageX className="size-4" />} title={`${low.length} part${low.length === 1 ? '' : 's'} low on stock`} action={<Link to="/inventory" className="text-[12px] font-medium text-accent">Inventory</Link>} />
      <ul className="space-y-0.5 px-4 pb-4 text-[13px]">
        {low.slice(0, 5).map((p) => (
          <li key={p.id} className="flex justify-between gap-2">
            <span className="truncate">{p.name}</span>
            <span className="tabular text-danger">{p.qty} left</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
