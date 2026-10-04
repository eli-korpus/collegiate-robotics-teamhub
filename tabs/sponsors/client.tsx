import { lazy } from 'react';
import { Handshake } from 'lucide-react';
import { defineClient } from '@teamhub/sdk';

export default defineClient('teamhub-module:sponsors', {
  icon: Handshake,
  Routes: lazy(() => import('./ui/Routes')),
  widgets: [{ id: 'followups', title: 'Sponsor follow-ups due', priority: 'today', perm: 'sponsors.view', component: lazy(() => import('./ui/Widget')) }],
  quickActions: [{ id: 'new', label: 'Add a sponsor', icon: Handshake, perm: 'sponsors.manage', href: '/sponsors?new=1', keywords: 'sponsorship donor company' }],
  entities: {
    sponsor: {
      label: 'Sponsor',
      icon: Handshake,
      fetch: async (sb, id) => {
        const { data } = await sb.from('spn_sponsors').select('id, name').eq('id', id).maybeSingle();
        return data ? { title: data.name, href: `/sponsors?item=${data.id}` } : null;
      },
    },
  },
  // RLS returns nothing for people who can't see sponsors, so search is safe for everyone.
  search: async (sb, q) => {
    const { data } = await sb.from('spn_sponsors').select('id, name, status').ilike('name', `%${q}%`).limit(5);
    return (data ?? []).map((s) => ({ id: s.id, title: s.name, subtitle: `Sponsor · ${s.status}`, href: `/sponsors?item=${s.id}` }));
  },
});
