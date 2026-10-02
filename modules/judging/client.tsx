import { lazy } from 'react';
import { Award } from 'lucide-react';
import { defineClient } from '@teamhub/sdk';

export default defineClient('teamhub-module:judging', {
  icon: Award,
  Routes: lazy(() => import('./ui/Routes')),
  quickActions: [{ id: 'drill', label: 'Practice judge interviews', icon: Award, perm: 'judging.view', href: '/judging', keywords: 'interview judges awards portfolio' }],
});
