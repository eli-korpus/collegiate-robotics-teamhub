import { Link } from 'react-router';
import { Shirt } from 'lucide-react';
import { Card, CardHeader, formatDate } from '@teamhub/ui';
import { useMe } from '@teamhub/sdk';
import { isOpen, useDrives, useOrders } from './data';

/** Open drives you haven't ordered from yet. */
export default function MerchOpen({ teamId }: { teamId: string | null }) {
  const me = useMe();
  const drives = useDrives();
  const orders = useOrders();
  const rows = (drives.data ?? []).filter((d) => isOpen(d) && (!teamId || !d.team_id || d.team_id === teamId) && !orders.data?.some((o) => o.drive_id === d.id && o.user_id === me.id));
  if (!rows.length) return null;
  return (
    <Card>
      <CardHeader icon={<Shirt className="size-4" />} title="Merch orders open" />
      <ul className="space-y-1 px-2 pb-3 text-[13px]">
        {rows.map((d) => (
          <li key={d.id}>
            <Link to={`/merch?item=${d.id}`} className="block truncate rounded-md px-2 py-1.5 hover:bg-bg-subtle">
              <span className="font-medium">{d.title}</span>
              {d.closes_at && <span className="text-muted"> · closes {formatDate(d.closes_at)}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
