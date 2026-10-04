import { lazy } from 'react';
import { SquareCheckBig, SquarePlus } from 'lucide-react';
import { defineClient } from '@teamhub/sdk';

export default defineClient('teamhub-module:tasks', {
  icon: SquareCheckBig,
  Routes: lazy(() => import('./ui/Routes')),
  widgets: [{ id: 'my-tasks', title: 'Your tasks', priority: 'today', component: lazy(() => import('./widgets/MyTasks')) }],
  quickActions: [{ id: 'new', label: 'New task', icon: SquarePlus, perm: 'tasks.create', href: '/tasks?new=1', keywords: 'todo assign work' }],
  profileSections: [{ id: 'tasks', title: 'Tasks', component: lazy(() => import('./ui/ProfileSection')) }],
  notifications: {
    'tasks.assigned': { text: 'assigned you a task' },
    'tasks.comment': { text: 'commented on your task' },
  },
  entities: {
    task: {
      label: 'Task',
      icon: SquareCheckBig,
      fetch: async (sb, id) => {
        const { data } = await sb.from('task_items').select('id, title').eq('id', id).maybeSingle();
        return data ? { title: data.title, href: `/tasks?item=${data.id}` } : null;
      },
    },
  },
  search: async (sb, q) => {
    const { data } = await sb.from('task_items').select('id, title, status').ilike('title', `%${q}%`).limit(5);
    return (data ?? []).map((t) => ({ id: String(t.id), title: t.title, subtitle: t.status, href: `/tasks?item=${t.id}` }));
  },
  activity: async (sb, limit) => {
    const { data } = await sb.from('task_items').select('id, title, created_by, created_at, done_at, assignee').order('created_at', { ascending: false }).limit(limit);
    return (data ?? []).map((t) =>
      t.done_at
        ? { id: `task-done:${t.id}`, at: t.done_at, actor: t.assignee?.[0] ?? null, text: `finished “${t.title}”`, href: `/tasks?item=${t.id}` }
        : { id: `task:${t.id}`, at: t.created_at, actor: t.created_by, text: `added the task “${t.title}”`, href: `/tasks?item=${t.id}` },
    );
  },
});
