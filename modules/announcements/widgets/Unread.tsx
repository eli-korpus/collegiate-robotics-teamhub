import { Link } from 'react-router';
import { Megaphone } from 'lucide-react';
import { Badge, Card, CardHeader, RelativeTime } from '@teamhub/ui';
import { useLastSeen, useMe } from '@teamhub/sdk';
import { useMyAcks, usePosts } from '../ui/Routes';

/** Today strip: unread and must-read announcements. */
export default function UnreadAnnouncements({ teamId }: { teamId: string | null }) {
  const posts = usePosts();
  const acks = useMyAcks();
  const me = useMe();
  const [lastSeen] = useLastSeen('announcements');
  const acked = new Set((acks.data ?? []).map((a) => a.post_id));
  const list = (posts.data ?? []).filter(
    (p) => (!teamId || !p.team_id || p.team_id === teamId) && p.created_by !== me.id && ((p.require_ack && !acked.has(p.id)) || new Date(p.created_at).getTime() > lastSeen),
  );
  if (!list.length) return null;
  return (
    <Card>
      <CardHeader icon={<Megaphone className="size-4" />} title={`${list.length} new announcement${list.length === 1 ? '' : 's'}`} />
      <ul className="space-y-1 px-2 pb-3">
        {list.slice(0, 3).map((p) => (
          <li key={p.id}>
            <Link to={`/announcements?item=${p.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-bg-subtle">
              <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
              {p.require_ack && !acked.has(p.id) && <Badge tone="warning">Must read</Badge>}
              <RelativeTime date={p.created_at} className="shrink-0 text-[11.5px] text-faint" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
