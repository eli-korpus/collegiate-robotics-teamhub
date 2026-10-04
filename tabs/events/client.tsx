import { lazy } from 'react';
import { Trophy } from 'lucide-react';
import { defineClient } from '@teamhub/sdk';
import { useCompetitionGreeting } from './greeting';

export default defineClient('teamhub-module:events', {
  icon: Trophy,
  Routes: lazy(() => import('./ui/Routes')),
  useGreeting: useCompetitionGreeting,
  widgets: [{ id: 'next-event', title: 'Next / last event', component: lazy(() => import('./widgets/NextEvent')) }],
  entities: {
    event: {
      label: 'Event',
      icon: Trophy,
      // id = "<season>/<code>"
      fetch: async (_sb, id) => ({ title: `Event ${id.split('/')[1] ?? id}`, href: `/events/${id}` }),
    },
  },
});
