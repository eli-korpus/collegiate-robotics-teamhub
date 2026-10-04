import { lazy } from 'react';
import { Printer } from 'lucide-react';
import { defineClient } from '@teamhub/sdk';

export default defineClient('teamhub-module:manufacture', {
  icon: Printer,
  Routes: lazy(() => import('./ui/Routes')),
  widgets: [
    { id: 'queue', title: 'Manufacturing queue', priority: 'today', component: lazy(() => import('./widgets/Queue')) },
    { id: 'my-parts', title: 'Your parts', component: lazy(() => import('./widgets/MyParts')) },
  ],
  quickActions: [{ id: 'submit', label: 'Submit a part to manufacture', hint: '3D print, CNC, laser…', icon: Printer, perm: 'manufacture.submit', href: '/manufacture?new=1', keywords: 'print cnc laser make', newMenuFor: ['tasks'] }],
  notifications: {
    'manufacture.new_job': { text: 'submitted a part for your queue' },
    'manufacture.status': { text: 'updated your part' },
  },
  entities: {
    job: {
      label: 'Part',
      icon: Printer,
      fetch: async (sb, id) => {
        const { data } = await sb.from('mfg_jobs').select('id, title').eq('id', id).maybeSingle();
        return data ? { title: data.title, href: `/manufacture?item=${data.id}` } : null;
      },
    },
  },
  search: async (sb, q) => {
    const { data } = await sb.from('mfg_jobs').select('id, title, status').ilike('title', `%${q}%`).limit(5);
    return (data ?? []).map((j) => ({ id: j.id, title: j.title, subtitle: j.status, href: `/manufacture?item=${j.id}` }));
  },
  activity: async (sb, limit) => {
    const { data } = await sb.from('mfg_jobs').select('id, title, requested_by, assigned_to, created_at, done_at').order('created_at', { ascending: false }).limit(limit);
    return (data ?? []).map((j) =>
      j.done_at
        ? { id: `mfg-done:${j.id}`, at: j.done_at, actor: j.assigned_to, text: `finished making “${j.title}”`, href: `/manufacture?item=${j.id}` }
        : { id: `mfg:${j.id}`, at: j.created_at, actor: j.requested_by, text: `submitted “${j.title}” to manufacture`, href: `/manufacture?item=${j.id}` },
    );
  },
});
