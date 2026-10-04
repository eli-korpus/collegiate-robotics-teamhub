import { lazy } from 'react';
import { Wrench } from 'lucide-react';
import { defineClient } from '@teamhub/sdk';

export default defineClient('teamhub-module:repairs', {
  icon: Wrench,
  Routes: lazy(() => import('./ui/Routes')),
  quickActions: [{ id: 'report', label: 'Report a breakage', hint: 'Log what broke and why', icon: Wrench, perm: 'repairs.report', href: '/repairs?new=1', keywords: 'broke broken issue repair', newMenuFor: ['tasks'] }],
  entities: {
    issue: {
      label: 'Repair issue',
      icon: Wrench,
      fetch: async (sb, id) => {
        const { data } = await sb.from('rep_issues').select('id, title').eq('id', id).maybeSingle();
        return data ? { title: data.title, href: `/repairs?item=${data.id}` } : null;
      },
    },
  },
  search: async (sb, q) => {
    const { data } = await sb.from('rep_issues').select('id, title, status').or(`title.ilike.%${q}%,cause.ilike.%${q}%`).limit(5);
    return (data ?? []).map((i) => ({ id: i.id, title: i.title, subtitle: i.status, href: `/repairs?item=${i.id}` }));
  },
  activity: async (sb, limit) => {
    const { data } = await sb.from('rep_issues').select('id, title, reported_by, created_at').order('created_at', { ascending: false }).limit(limit);
    return (data ?? []).map((i) => ({ id: `rep:${i.id}`, at: i.created_at, actor: i.reported_by, text: `reported “${i.title}”`, href: `/repairs?item=${i.id}` }));
  },
});
