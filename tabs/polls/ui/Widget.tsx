import { Link } from 'react-router';
import { Vote } from 'lucide-react';
import { Card, CardHeader } from '@teamhub/ui';
import { isOpen, useMyVotes, usePolls } from './Routes';

/** Open polls you haven't answered. */
export default function OpenPolls({ teamId }: { teamId: string | null }) {
  const polls = usePolls();
  const votes = useMyVotes();
  const voted = new Set((votes.data ?? []).map((v) => v.poll_id));
  const todo = (polls.data ?? []).filter((p) => isOpen(p) && !voted.has(p.id) && (!teamId || !p.team_id || p.team_id === teamId));
  if (!todo.length) return null;
  return (
    <Card>
      <CardHeader icon={<Vote className="size-4" />} title={`${todo.length} poll${todo.length === 1 ? '' : 's'} waiting for you`} />
      <ul className="space-y-1 px-2 pb-3">
        {todo.slice(0, 3).map((p) => (
          <li key={p.id}>
            <Link to={`/polls?item=${p.id}`} className="block truncate rounded-md px-2 py-1.5 text-[13px] hover:bg-bg-subtle">
              {p.question}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
