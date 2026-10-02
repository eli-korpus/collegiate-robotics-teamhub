import { Link } from 'react-router';
import { Megaphone } from 'lucide-react';
import { Card, CardHeader, StatusPill, addDays } from '@teamhub/ui';
import { canWith, useMe } from '@teamhub/sdk';
import { firstLine, usePosts } from './data';

/** Approvers: posts waiting for approval. Everyone: posts scheduled in the next 2 days. */
export default function PostsNeedingAttention({ teamId }: { teamId: string | null }) {
  const me = useMe();
  const posts = usePosts();
  const soon = addDays(new Date(), 2);
  const rows = (posts.data ?? [])
    .filter((p) => !teamId || !p.team_id || p.team_id === teamId)
    .filter((p) => (p.status === 'approval' && canWith(me, 'social.approve', p.team_id)) || (p.status === 'scheduled' && p.scheduled_for && new Date(p.scheduled_for) <= soon));
  if (!rows.length) return null;
  return (
    <Card>
      <CardHeader icon={<Megaphone className="size-4" />} title="Social posts" />
      <ul className="space-y-1 px-2 pb-3 text-[13px]">
        {rows.slice(0, 4).map((p) => (
          <li key={p.id}>
            <Link to={`/social?item=${p.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-bg-subtle">
              <span className="min-w-0 flex-1 truncate">{firstLine(p.caption)}</span>
              <StatusPill label={p.status === 'approval' ? 'Approve' : new Date(p.scheduled_for!) < new Date() ? 'Overdue' : 'Post soon'} tone={p.status === 'approval' || new Date(p.scheduled_for!) < new Date() ? 'warning' : 'info'} />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
