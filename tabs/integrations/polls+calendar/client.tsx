import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Vote } from 'lucide-react';
import { Button } from '@teamhub/ui';
import { canWith, makeRef, useMe, useSupabase, type IntegrationClient } from '@teamhub/sdk';

function EventPolls({ event }: { event: { id: string; title: string; team_id: string | null } }) {
  const sb = useSupabase();
  const me = useMe();
  const nav = useNavigate();
  const ref = makeRef('calendar', 'event', event.id);
  const q = useQuery({
    queryKey: ['polls', 'for-event', ref],
    queryFn: async () => {
      const { data } = await sb.from('poll_polls').select('id, question').eq('ref', ref);
      return (data ?? []) as { id: string; question: string }[];
    },
  });
  return (
    <>
      {(q.data ?? []).map((p) => (
        <Link key={p.id} to={`/polls?item=${p.id}`} className="inline-flex h-8 max-w-64 items-center gap-1.5 truncate rounded-md border border-border px-3 text-[13px] hover:bg-bg-subtle">
          <Vote className="size-4 shrink-0" /> <span className="truncate">{p.question}</span>
        </Link>
      ))}
      {canWith(me, 'polls.create', event.team_id) && (
        <Button size="sm" variant="ghost" icon={<Vote className="size-4" />} onClick={() => nav(`/polls?new=1&ref=${encodeURIComponent(ref)}`)}>
          Ask a poll
        </Button>
      )}
    </>
  );
}

const client: IntegrationClient = { id: 'polls+calendar', slots: { 'calendar.event.actions': EventPolls } };
export default client;
