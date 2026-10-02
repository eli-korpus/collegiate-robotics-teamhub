import { lazy } from 'react';
import { Boxes } from 'lucide-react';
import { defineClient } from '@teamhub/sdk';

export default defineClient('teamhub-module:inventory', {
  icon: Boxes,
  Routes: lazy(() => import('./ui/Routes')),
  widgets: [{ id: 'low', title: 'Low stock', component: lazy(() => import('./widgets/Low')) }],
  entities: {
    item: {
      label: 'Part',
      icon: Boxes,
      fetch: async (sb, id) => {
        const { data } = await sb.from('inv_items').select('id, name').eq('id', id).maybeSingle();
        return data ? { title: data.name, href: '/inventory' } : null;
      },
    },
  },
  search: async (sb, q) => {
    const { data } = await sb.from('inv_items').select('id, name, qty, location').or(`name.ilike.%${q}%,sku.ilike.%${q}%`).limit(5);
    return (data ?? []).map((p) => ({ id: p.id, title: p.name, subtitle: `${p.qty} in stock${p.location ? ` · ${p.location}` : ''}`, href: '/inventory' }));
  },
});
