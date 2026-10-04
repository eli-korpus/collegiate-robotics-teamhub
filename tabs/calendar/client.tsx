import { lazy } from 'react';
import { CalendarDays, CalendarPlus } from 'lucide-react';
import { defineClient } from '@teamhub/sdk';

export default defineClient('teamhub-module:calendar', {
  icon: CalendarDays,
  Routes: lazy(() => import('./ui/Routes')),
  widgets: [{ id: 'up-next', title: 'Up next', component: lazy(() => import('./widgets/UpNext')) }],
  quickActions: [{ id: 'new-event', label: 'New calendar event', icon: CalendarPlus, perm: 'calendar.create', href: '/calendar?new=1', keywords: 'schedule practice meeting' }],
  entities: {
    event: {
      label: 'Event',
      icon: CalendarDays,
      fetch: async (sb, id) => {
        const { data } = await sb.from('cal_events').select('id, title').eq('id', id).maybeSingle();
        return data ? { title: data.title, href: '/calendar' } : null;
      },
    },
  },
  search: async (sb, q) => {
    const { data } = await sb.from('cal_events').select('id, title, starts_at').ilike('title', `%${q}%`).order('starts_at', { ascending: false }).limit(5);
    return (data ?? []).map((e) => ({ id: e.id, title: e.title, subtitle: new Date(e.starts_at).toLocaleDateString(), href: '/calendar' }));
  },
});
