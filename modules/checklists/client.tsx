import { lazy } from 'react';
import { ListChecks } from 'lucide-react';
import { defineClient } from '@teamhub/sdk';

export default defineClient('teamhub-module:checklists', {
  icon: ListChecks,
  Routes: lazy(() => import('./ui/Routes')),
  quickActions: [{ id: 'open', label: 'Run a checklist', icon: ListChecks, perm: 'checklists.run', href: '/checklists', keywords: 'pre-match pit packing inspection' }],
  entities: {
    list: {
      label: 'Checklist',
      icon: ListChecks,
      fetch: async (sb, id) => {
        const { data } = await sb.from('chk_lists').select('id, name').eq('id', id).maybeSingle();
        return data ? { title: data.name, href: `/checklists/${data.id}` } : null;
      },
    },
  },
  search: async (sb, q) => {
    const { data } = await sb.from('chk_lists').select('id, name, kind').ilike('name', `%${q}%`).limit(5);
    return (data ?? []).map((l) => ({ id: l.id, title: l.name, subtitle: l.kind, href: `/checklists/${l.id}` }));
  },
});
