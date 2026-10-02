import { lazy } from 'react';
import { ShoppingCart } from 'lucide-react';
import { defineClient } from '@teamhub/sdk';

export default defineClient('teamhub-module:purchases', {
  icon: ShoppingCart,
  Routes: lazy(() => import('./ui/Routes')),
  widgets: [{ id: 'to-order', title: 'Purchases to order', priority: 'today', perm: 'purchases.order', component: lazy(() => import('./widgets/ToOrder')) }],
  quickActions: [{ id: 'new', label: 'Request a purchase', hint: 'Ask a mentor to buy something', icon: ShoppingCart, perm: 'purchases.request', href: '/purchases?new=1', keywords: 'buy order parts', newMenuFor: ['tasks'] }],
  notifications: {
    'purchases.new': { text: 'asked for something to be bought' },
    'purchases.status': { text: 'updated your purchase request' },
  },
  entities: {
    request: {
      label: 'Purchase request',
      icon: ShoppingCart,
      fetch: async (sb, id) => {
        const { data } = await sb.from('pur_requests').select('id, item').eq('id', id).maybeSingle();
        return data ? { title: data.item, href: `/purchases?item=${data.id}` } : null;
      },
    },
  },
  search: async (sb, q) => {
    const { data } = await sb.from('pur_requests').select('id, item, status').ilike('item', `%${q}%`).limit(5);
    return (data ?? []).map((r) => ({ id: r.id, title: r.item, subtitle: r.status, href: `/purchases?item=${r.id}` }));
  },
  activity: async (sb, limit) => {
    const { data } = await sb.from('pur_requests').select('id, item, requested_by, created_at').order('created_at', { ascending: false }).limit(limit);
    return (data ?? []).map((r) => ({ id: `pur:${r.id}`, at: r.created_at, actor: r.requested_by, text: `requested “${r.item}”`, href: `/purchases?item=${r.id}` }));
  },
});
