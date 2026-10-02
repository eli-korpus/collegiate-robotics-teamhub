import { lazy } from 'react';
import { FileCheck2 } from 'lucide-react';
import { defineClient } from '@teamhub/sdk';

export default defineClient('teamhub-module:paperwork', {
  icon: FileCheck2,
  Routes: lazy(() => import('./ui/Routes')),
  widgets: [{ id: 'owed', title: 'Paperwork you owe', priority: 'today', component: lazy(() => import('./ui/Widget')) }],
});
