import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ListChecks } from 'lucide-react';
import { buttonClass } from '@teamhub/ui';
import { useSupabase, type IntegrationClient } from '@teamhub/sdk';

function Shortcuts() {
  const sb = useSupabase();
  const q = useQuery({ queryKey: ['checklists', 'judging-shortcuts'], queryFn: async () => (await sb.from('chk_lists').select('id, name').in('kind', ['judging', 'portfolio'])).data ?? [] });
  return (
    <>
      {(q.data ?? []).map((l) => (
        <Link key={l.id} to={`/checklists/${l.id}`} className={buttonClass('ghost', 'sm', 'max-w-full')}>
          <ListChecks className="size-4" /> <span className="min-w-0 truncate">{l.name}</span>
        </Link>
      ))}
    </>
  );
}

const client: IntegrationClient = { id: 'judging+checklists', slots: { 'judging.shortcuts': Shortcuts } };
export default client;
