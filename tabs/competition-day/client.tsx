import { lazy } from 'react';
import { Timer } from 'lucide-react';
import { defineClient } from '@teamhub/sdk';

export default defineClient('teamhub-module:competition-day', {
  icon: Timer,
  Routes: lazy(() => import('./ui/Routes')),
  widgets: [{ id: 'next-match', title: 'Next match', priority: 'today', component: lazy(() => import('./widgets/NextMatch')) }],
  quickActions: [{ id: 'open', label: 'Competition Day', hint: 'Next match, partners, rankings', icon: Timer, href: '/competition-day', keywords: 'event match next live' }],
});
