import { Link } from 'react-router';
import { ShoppingCart } from 'lucide-react';
import { Card, CardHeader } from '@teamhub/ui';
import { canWith, useMe } from '@teamhub/sdk';
import { useRequests } from '../ui/Routes';

/** Today strip for orderers: requests waiting to be ordered; for requesters: updates on their requests. */
export default function ToOrder({ teamId }: { teamId: string | null }) {
  const me = useMe();
  const list = useRequests();
  const rows = (list.data ?? []).filter((r) => !teamId || !r.team_id || r.team_id === teamId);
  const toOrder = rows.filter((r) => r.status === 'requested' && canWith(me, 'purchases.order', r.team_id));
  if (!toOrder.length) return null;
  return (
    <Card>
      <CardHeader icon={<ShoppingCart className="size-4" />} title={`${toOrder.length} purchase request${toOrder.length === 1 ? '' : 's'} to order`} action={<Link to="/purchases" className="text-[12px] font-medium text-accent">Review</Link>} />
      <ul className="space-y-1 px-4 pb-4 text-[13px]">
        {toOrder.slice(0, 4).map((r) => (
          <li key={r.id} className="truncate">
            <Link to={`/purchases?item=${r.id}`} className="hover:underline">
              {r.qty > 1 ? `${r.qty}× ` : ''}
              {r.item}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
