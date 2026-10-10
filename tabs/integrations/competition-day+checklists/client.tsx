import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ListChecks } from 'lucide-react';
import { buttonClass } from '@teamhub/ui';
import { useSupabase, type IntegrationClient } from '@teamhub/sdk';

function Shortcuts() {
  const sb = useSupabase();
  const q = useQuery({
    queryKey: ['checklists', 'compday'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const lists = (await sb.from('chk_lists').select('id, name, items').in('kind', ['robot', 'pit', 'inspection'])).data ?? [];
      const runs = (await sb.from('chk_runs').select('list_id, checked, completed_at, started_at').gte('started_at', new Date(Date.now() - 12 * 3_600_000).toISOString()).order('started_at', { ascending: false })).data ?? [];
      return lists.map((l) => {
        const r = runs.find((x) => x.list_id === l.id);
        return { id: l.id, name: l.name, progress: r ? `${(r.checked as string[]).length}/${(l.items as unknown[]).length}` : null, done: !!r?.completed_at };
      });
    },
  });
  return (
    <>
      {(q.data ?? []).map((l) => (
        <Link key={l.id} to={`/checklists/${l.id}`} className={buttonClass(l.done ? 'soft' : 'secondary', 'sm', 'max-w-full')}>
          <ListChecks className="size-4" /> <span className="min-w-0 truncate">{l.name}</span>
          {l.progress && <span className="tabular text-[11.5px] opacity-80">{l.progress}</span>}
        </Link>
      ))}
    </>
  );
}

const client: IntegrationClient = { id: 'competition-day+checklists', slots: { 'competition-day.shortcuts': Shortcuts } };
export default client;
