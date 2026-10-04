import { lazy } from 'react';
import { Vote } from 'lucide-react';
import { defineClient } from '@teamhub/sdk';

export default defineClient('teamhub-module:polls', {
  icon: Vote,
  Routes: lazy(() => import('./ui/Routes')),
  widgets: [{ id: 'open', title: 'Open polls', priority: 'today', component: lazy(() => import('./ui/Widget')) }],
  quickActions: [
    { id: 'new', label: 'Create a poll', icon: Vote, perm: 'polls.create', href: '/polls?new=1', keywords: 'vote decide' },
    { id: 'time', label: 'Find a time that works', icon: Vote, perm: 'polls.create', href: '/polls?new=1', keywords: 'availability schedule when' },
  ],
  entities: {
    poll: {
      label: 'Poll',
      icon: Vote,
      fetch: async (sb, id) => {
        const { data } = await sb.from('poll_polls').select('id, question').eq('id', id).maybeSingle();
        return data ? { title: data.question, href: `/polls?item=${data.id}` } : null;
      },
    },
  },
  search: async (sb, q) => {
    const { data } = await sb.from('poll_polls').select('id, question').ilike('question', `%${q}%`).limit(5);
    return (data ?? []).map((p) => ({ id: p.id, title: p.question, href: `/polls?item=${p.id}` }));
  },
});
