import { lazy } from 'react';
import { ScanSearch } from 'lucide-react';
import { defineClient } from '@teamhub/sdk';

export default defineClient('teamhub-module:scouting', {
  icon: ScanSearch,
  Routes: lazy(() => import('./ui/Routes')),
  quickActions: [{ id: 'scout', label: 'Scout a match', icon: ScanSearch, perm: 'scouting.scout', href: '/scouting', keywords: 'scouting match pit pick list' }],
});
