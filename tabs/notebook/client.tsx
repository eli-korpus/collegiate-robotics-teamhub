import { lazy } from 'react';
import { NotebookPen } from 'lucide-react';
import { defineClient } from '@teamhub/sdk';

export default defineClient('teamhub-module:notebook', {
  icon: NotebookPen,
  Routes: lazy(() => import('./ui/Routes')),
  widgets: [{ id: 'recent', title: 'Notebook this week', component: lazy(() => import('./widgets/Recent')) }],
  quickActions: [{ id: 'new', label: 'Write a notebook entry', icon: NotebookPen, perm: 'notebook.write', href: '/notebook?new=1', keywords: 'engineering log design iteration' }],
  entities: {
    entry: {
      label: 'Notebook entry',
      icon: NotebookPen,
      fetch: async (sb, id) => {
        const { data } = await sb.from('nb_entries').select('id, title').eq('id', id).maybeSingle();
        return data ? { title: data.title, href: `/notebook?item=${data.id}` } : null;
      },
    },
  },
  search: async (sb, q) => {
    const { data } = await sb.from('nb_entries').select('id, title, date').or(`title.ilike.%${q}%,body.ilike.%${q}%`).order('date', { ascending: false }).limit(5);
    return (data ?? []).map((e) => ({ id: e.id, title: e.title, subtitle: e.date, href: `/notebook?item=${e.id}` }));
  },
  activity: async (sb, limit) => {
    const { data } = await sb.from('nb_entries').select('id, title, created_by, created_at, kind').order('created_at', { ascending: false }).limit(limit);
    return (data ?? []).map((e) => ({ id: `nb:${e.id}`, at: e.created_at, actor: e.created_by, text: `${e.kind === 'iteration' ? 'logged a design iteration' : 'wrote'} “${e.title}”`, href: `/notebook?item=${e.id}` }));
  },
});
