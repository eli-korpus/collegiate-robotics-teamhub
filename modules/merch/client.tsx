import { lazy } from 'react';
import { Shirt } from 'lucide-react';
import { defineClient } from '@teamhub/sdk';

export default defineClient('teamhub-module:merch', {
  icon: Shirt,
  Routes: lazy(() => import('./ui/Routes')),
  widgets: [{ id: 'open', title: 'Merch orders open', priority: 'today', component: lazy(() => import('./ui/Widget')) }],
  quickActions: [{ id: 'new', label: 'Start a merch order', icon: Shirt, perm: 'merch.manage', href: '/merch?new=1', keywords: 'shirts hoodies apparel order' }],
  entities: {
    drive: {
      label: 'Merch order',
      icon: Shirt,
      fetch: async (sb, id) => {
        const { data } = await sb.from('mer_drives').select('id, title').eq('id', id).maybeSingle();
        return data ? { title: data.title, href: `/merch?item=${data.id}` } : null;
      },
    },
  },
});
