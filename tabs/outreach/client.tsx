import { lazy } from 'react';
import { HeartHandshake } from 'lucide-react';
import { defineClient } from '@teamhub/sdk';

export default defineClient('teamhub-module:outreach', {
  icon: HeartHandshake,
  Routes: lazy(() => import('./ui/Routes')),
  widgets: [
    { id: 'season', title: 'Season outreach', component: lazy(() => import('./ui/Widget')) },
    { id: 'approve', title: 'Hours to approve', priority: 'today', perm: 'outreach.approve_hours', component: lazy(() => import('./ui/ApproveWidget')) },
  ],
  profileSections: [{ id: 'outreach', title: 'Outreach hours', component: lazy(() => import('./ui/ProfileSection')) }],
  quickActions: [{ id: 'new', label: 'Log an outreach event', icon: HeartHandshake, perm: 'outreach.create_event', href: '/outreach?new=1', keywords: 'volunteer hours community demo' }],
  entities: {
    event: {
      label: 'Outreach event',
      icon: HeartHandshake,
      fetch: async (sb, id) => {
        const { data } = await sb.from('out_events').select('id, title, date').eq('id', id).maybeSingle();
        return data ? { title: data.title, subtitle: data.date, href: `/outreach?item=${data.id}` } : null;
      },
    },
  },
  search: async (sb, q) => {
    const { data } = await sb.from('out_events').select('id, title, date').ilike('title', `%${q}%`).limit(5);
    return (data ?? []).map((e) => ({ id: e.id, title: e.title, subtitle: `Outreach · ${e.date}`, href: `/outreach?item=${e.id}` }));
  },
});
