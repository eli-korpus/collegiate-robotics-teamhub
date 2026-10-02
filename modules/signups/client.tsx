import { lazy } from 'react';
import { ClipboardPen } from 'lucide-react';
import { defineClient } from '@teamhub/sdk';

export default defineClient('teamhub-module:signups', {
  icon: ClipboardPen,
  Routes: lazy(() => import('./ui/Routes')),
  widgets: [{ id: 'mine', title: 'Your sign-ups', priority: 'today', component: lazy(() => import('./ui/Widget')) }],
  quickActions: [{ id: 'new', label: 'Create a sign-up sheet', icon: ClipboardPen, perm: 'signups.create', href: '/signups?new=1', keywords: 'volunteer slots snacks shifts' }],
  entities: {
    sheet: {
      label: 'Sign-up sheet',
      icon: ClipboardPen,
      fetch: async (sb, id) => {
        const { data } = await sb.from('sign_sheets').select('id, title').eq('id', id).maybeSingle();
        return data ? { title: data.title, href: `/signups?item=${data.id}` } : null;
      },
    },
  },
  search: async (sb, q) => {
    const { data } = await sb.from('sign_sheets').select('id, title').ilike('title', `%${q}%`).limit(5);
    return (data ?? []).map((s) => ({ id: s.id, title: s.title, subtitle: 'Sign-up sheet', href: `/signups?item=${s.id}` }));
  },
});
